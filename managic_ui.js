// managic_ui.js — UI helpers for managic_dom.js (ESM, no dependencies)
import { Core, Group, Entity, Sprite, Label, Event } from './managic_dom.js';

/**
 * FrameWindow
 * - 背景色/枠線/角丸などをプリセットから簡単適用
 * - サイズ変更・パディング・内容物の自動配置（contentコンテナ）付き
 */
export class FrameWindow extends Group {
  constructor(width=200, height=120, preset='panel') {
    super();
    this._w = width|0; this._h = height|0;

    // 背面パネル（CSSで描画）
    this._panel = new Entity(width, height);
    this._panel._element.style.boxSizing = 'border-box';
    this._panel._element.style.pointerEvents = 'none'; // パネル自体はクリック透過
    this.addChild(this._panel);

    // コンテンツ入れ
    this.content = new Group();
    this._padding = { top:12, right:12, bottom:12, left:12 };
    this.addChild(this.content);

    // デフォルトプリセット
    this._presets = {
      panel: {
        background: '#f6f7f9', border: '1px solid #cfd8dc',
        radius: 8, shadow: '0 2px 8px rgba(0,0,0,.12)'
      },
      dark: {
        background: '#1e2430', border: '1px solid #2c3140',
        radius: 10, shadow: '0 6px 16px rgba(0,0,0,.35)'
      },
      glass: {
        background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.25)',
        radius: 12, backdropFilter: 'blur(6px)', shadow: '0 6px 18px rgba(0,0,0,.35)'
      },
      accent: {
        background: '#fff7e6', border: '2px solid #ffb300',
        radius: 12, shadow: '0 4px 14px rgba(255,179,0,.25)'
      }
    };

    this.usePreset(preset);
    this._relayout();
  }

  // パディング（数値 or オブジェクト）
  set padding(p) {
    if (typeof p === 'number') {
      this._padding = { top:p, right:p, bottom:p, left:p };
    } else {
      this._padding = { ...this._padding, ...p };
    }
    this._relayout();
  }
  get padding(){ return this._padding; }

  setSize(w, h){
    this._w = w|0; this._h = h|0;
    this._panel.width = this._w;
    this._panel.height = this._h;
    this._relayout();
    return this;
  }

  usePreset(name, overrides={}){
    const p = this._presets[name] || {};
    const opt = { ...p, ...overrides };
    const st = this._panel._element.style;
    st.background = opt.background ?? '';
    st.border = opt.border ?? '0';
    st.borderRadius = (opt.radius!=null ? (opt.radius|0)+'px' : '0');
    st.boxShadow = opt.shadow ?? 'none';
    st.backdropFilter = opt.backdropFilter ?? 'none';
    // サイズ再適用
    this._panel.width = this._w; this._panel.height = this._h;
    return this;
  }

  // コンテンツ自動配置（左上にpadding分オフセット）
  _relayout(){
    const { top, left } = this._padding;
    this.content.x = left|0;
    this.content.y = top|0;
    // contentの可視領域（参考値）を保持したい場合は下記を利用
    this.contentWidth  = Math.max(0, this._w - this._padding.left - this._padding.right);
    this.contentHeight = Math.max(0, this._h - this._padding.top  - this._padding.bottom);
  }
}

/**
 * UIButton
 * - 枠スプライト（Sprite）＋ラベル（Label）を組み合わせたボタン
 * - 画像が無い場合でも最低限のCSSボタンとして動作
 * - states: normal / hover / active / disabled（frame差し替え or CSSテーマ切替）
 */
export class UIButton extends Group {
  constructor(width=120, height=40, options={}){
    super();
    this._w = width|0; this._h = height|0;
    this._enabled = true;
    // テキスト自動フィット設定
    this._autoFitText = options.autoFitText !== false; // 既定ON
    this._minFontSize = (options.minFontSize|0) || 10;
    this._maxFontSize = (options.maxFontSize|0) || 16;  // 0=初期フォントサイズを上限とする
    this._paddingX   = options.paddingX ?? 12;
    this._paddingY   = options.paddingY ?? 6;
    this._baseFontSize = null; // 初期フォントサイズ（上限）を保存

    // 背景：Sprite（画像があれば使う）。無ければCSSで描くEntityにフォールバック
    this._bgSprite = null;
    if (options.image instanceof HTMLImageElement || typeof options.image === 'string') {
      this._bgSprite = new Sprite(width, height);
      this._bgSprite.image = options.image;
      this.addChild(this._bgSprite);
    } else {
      this._bg = new Entity(width, height);
      const st = this._bg._element.style;
      st.boxSizing='border-box';
      // デフォルトCSSテーマ（必要に応じて変更）
      st.background = '#2b87ff';
      st.border = '1px solid #0f5bd5';
      st.borderRadius = '10px';
      st.boxShadow = '0 3px 10px rgba(0,0,0,.25)';
      this.addChild(this._bg);
    }

    // ラベル
    this.label = new Label(options.text || 'Button');
    this.label.color = options.color || '#fff';
    this.label.font  = options.font  || 'bold 16px system-ui, sans-serif';
    this.label.fitToTextWidth = true; //ボタン内ラベルは文字幅に合わせる
    this.addChild(this.label);
    
    // --- ヒット用カバー（最前面・透明）---
    this._hit = new Entity(width, height);
    const hs = this._hit._element.style;
    hs.background = 'transparent';
    hs.pointerEvents = 'auto';
    hs.left = '0px'; hs.top = '0px';
    this.addChild(this._hit); // << ラベルより上に追加（イベントを確実に拾う）

    // PCホバー用は _element ではなく _hit 側で
    this._hit._element.addEventListener('mouseenter', ()=> this._onHover(true));
    this._hit._element.addEventListener('mouseleave', ()=> this._onHover(false));

    // タッチ系は _hit にバインドし、親(UIButton)へフォワード
    this._hit.on(Event.TOUCH_START, ()=> this._onPress(true));
    this._hit.on(Event.TOUCH_END,   ()=> {
      this._onPress(false);
      // 親に touchend を“発火” → btn.ontouchend / btn.on('touchend') が効く
      this.dispatchEvent(new Event(Event.TOUCH_END));
      // クリック相当も発火 → btn.on('click') が効く
      this.dispatchEvent(new Event('click'));
    });


    // frameセット（スプライト用）。{normal, hover, active, disabled}
    this._frames = options.frames || null;

    // CSSテーマ（非画像時）。{normal, hover, active, disabled}
    this._themes = options.themes || {
      normal:  { bg:'#2b87ff', border:'#0f5bd5', color:'#fff' },
      hover:   { bg:'#4897ff', border:'#0f5bd5', color:'#fff' },
      active:  { bg:'#166ff0', border:'#0b4cc0', color:'#eaf3ff' },
      disabled:{ bg:'#9db9e8', border:'#8aa3cc', color:'#f6f9ff' }
    };

    // DOMのhoverも拾って視覚反応（PC用）
    this._element.addEventListener('mouseenter', ()=> this._onHover(true));
    this._element.addEventListener('mouseleave', ()=> this._onHover(false));

    // タッチ系（エンジンから来る）
    this.on(Event.TOUCH_START, ()=> this._onPress(true));
    this.on(Event.TOUCH_END,   ()=> this._onPress(false));

    this._applyState('normal');
    this._relayout();
  }

  setSize(w,h){
    console.log("btn setSize", w, h);
    this._w=w|0; this._h=h|0;
    if (this._bgSprite){ this._bgSprite.width=this._w; this._bgSprite.height=this._h; }
    if (this._bg){ this._bg.width=this._w; this._bg.height=this._h; }
    if (this._hit){ this._hit.width = this._w; this._hit.height = this._h; }
    this._relayout(); return this;
  }

  setText(text){
    this.label.fontSize = this._maxFontSize;
    this.label.text = text; 
    this._relayout(); 
    return this; 
  }

  setEnabled(flag){
    this._enabled = !!flag;
    this.touchEnabled = this._enabled;
    this._applyState(this._enabled ? 'normal' : 'disabled');
  }

  setFrames(map){ this._frames = map; this._applyState('normal'); }
  setThemes(map){ this._themes = map; this._applyState('normal'); }

  // 内部：ラベル中央寄せ
  _relayout(){
    //const paddingX = 12, paddingY = 6;
    // Labelは自動採寸なので、中央寄せにする
    // this.label.x = Math.round((this._w - this.label.width)/2);
    // this.label.y = Math.round((this._h - this.label.height)/2);
    // 余白を確保（必要なら）
    // this.label.x = Math.max(paddingX, this.label.x);
    // this.label.y = Math.max(paddingY, this.label.y);
    // 1) 内側幅を算出
    const innerW = Math.max(0, this._w - this._paddingX*2);
    // 2) はみ出していればフォントを縮める
    this._fitTextToWidth(innerW);
    // 3) 中央寄せ
    this.label.x = Math.round((this._w - this.label.width)/2);
    this.label.y = Math.round((this._h - this.label.height)/2);
  }

  _applyState(state){
    if (this._bgSprite && this._frames){
      const f = this._frames[state] ?? this._frames.normal ?? 0;
      this._bgSprite.frame = f;
    } else if (this._bg) {
      const th = this._themes[state] ?? this._themes.normal;
      const st = this._bg._element.style;
      st.background = th.bg;
      st.border = `1px solid ${th.border}`;
      this.label.color = th.color || this.label.color;
      st.opacity = (state === 'disabled') ? '0.6' : '1';
    }
  }

  _onHover(enter){
    if (!this._enabled) return;
    this._applyState(enter ? 'hover' : 'normal');
  }

  _onPress(down){
    if (!this._enabled) return;
    this._applyState(down ? 'active' : 'normal');
    if (!down){
      // “クリック”相当の発火（touchend時）
      const ev = new Event('click');
      this.dispatchEvent(ev);
    }
  }

  // ---- 追加：テキスト幅に合わせてフォントサイズを自動縮小 ----
  _currentLabelFontPx(){
    // Label.fontSize がある実装なので優先。なければ getComputedStyle。
    const fs = (typeof this.label.fontSize === 'number')
      ? this.label.fontSize
      : parseFloat(getComputedStyle(this.label._element).fontSize) || 16;
    return Math.max(1, fs|0);
  }
  _setLabelFontPx(px){
    if (typeof this.label.fontSize === 'number' || this.label.fontSize === undefined){
      this.label.fontSize = px;            // managic_dom の拡張セッターに対応
    } else {
      // 念のための互換（font 文字列を直接書き換える）
      const fam = this.label.fontFamily || 'system-ui, sans-serif';
      const weight = this.label.fontWeight || 'normal';
      this.label.font = `${weight} ${px}px ${fam}`;
    }
  }
  _fitTextToWidth(maxWidth){
    if (!this._autoFitText) return;
    if (!maxWidth || maxWidth <= 0) return;
    // 既定では「縮めるだけ」。上限は現在サイズ or options.maxFontSize
    const start = this._currentLabelFontPx();
    const upper = this._maxFontSize > 0 ? Math.min(this._maxFontSize, start) : start;
    let size = upper;
    // まず今のサイズで収まるか確認（多くのケースでループ不要）
    if (this.label.textWidth <= maxWidth) return;
    // 下限まで 1px ずつ縮小（はみ出さなくなったら停止）
    while (size > this._minFontSize){
      size -= 1;
      this._setLabelFontPx(size);
      if (this.label.textWidth <= maxWidth) break;
    }
  }
}


// ===============================================
// LabelArea — 複数行テキスト / タイプライタ / 基本禁則 / [b][u] 強調
// ===============================================
export class LabelArea extends Entity {
  /**
   * @param {number} width  表示領域の幅
   * @param {number} height 表示領域の高さ（オーバー分は隠す）
   * @param {object} opts   { text, speed, font, fontSize, color, lineHeight }
   */
  constructor(width=240, height=120, opts={}){
    super(width, height);
    this._element.classList.add('managic-labelarea');
    const st = this._element.style;
    st.overflow = 'hidden';
    st.whiteSpace = 'normal';
    st.boxSizing = 'border-box';

    // 表示用コンテンツ
    this._content = document.createElement('div');
    const cs = this._content.style;
    cs.position = 'absolute';
    cs.left = '0'; cs.top = '0';
    cs.whiteSpace = 'pre-wrap';     // 明示的な \n を尊重
    cs.wordBreak  = 'keep-all';     // 日本語は字間で折り返す（禁則は自前で調整）
    cs.textAlign  = 'left';
    cs.pointerEvents = 'none';
    this._element.appendChild(this._content);

    // 設定
    this._font = opts.font || '16px system-ui, sans-serif';
    this._fontSize = opts.fontSize || this._parseFontSizePx(this._font) || 16;
    this._lineHeight = opts.lineHeight || 1.4;
    this._color = opts.color || '#111';
    this._speed = Math.max(0, (opts.speed|0) || 0); // 0 = 即時

    // 状態
    this._rawText = opts.text || '';
    this._tokens = [];          // [{ch, b:boolean, u:boolean}]
    this._visible = Infinity;   // 見せる文字数
    this._ticker = 0;           // フレームカウンタ
    this._running = false;

    this._applyFontStyles();
    this.setText(this._rawText);

    // 進行（enterframe）
    this.on(Event.ENTER_FRAME, ()=> {
      if (!this._running || this._speed <= 0) return;
      this._ticker++;
      if (this._ticker % this._speed === 0) {
        if (this._visible < this._plainLength()) {
          this._visible++;
          this._render(); // 表示更新
        } else {
          this._running = false; // 終了
        }
      }
    });
  }

  // -------- public properties --------
  get text(){ return this._rawText; }
  set text(v){ this.setText(v); }

  get speed(){ return this._speed; }
  set speed(v){ this._speed = Math.max(0, v|0); }

  get font(){ return this._font; }
  set font(v){ this._font = v || this._font; this._fontSize = this._parseFontSizePx(this._font)||this._fontSize; this._applyFontStyles(); this._render(); }

  get fontSize(){ return this._fontSize; }
  set fontSize(px){ this._fontSize = (px|0)||this._fontSize; this._applyFontStyles(true); this._render(); }

  get lineHeight(){ return this._lineHeight; }
  set lineHeight(f){ this._lineHeight = +f || this._lineHeight; this._applyFontStyles(true); this._render(); }

  get color(){ return this._color; }
  set color(v){ this._color = v || this._color; this._content.style.color = this._color; }

  // -------- public methods --------
  /** テキストをセット（[b]太字[/b], [u]下線[/u], 改行 \n をサポート） */
  setText(raw){
    this._rawText = String(raw || '');
    this._tokens = this._tokenize(this._rawText);
    this.resetTyping();
    this._render();
    return this;
  }

  /** タイプ開始（speed>0のとき有効） */
  play(){ this._running = true; return this; }
  pause(){ this._running = false; return this; }
  resetTyping(){ this._visible = (this._speed>0 ? 0 : this._plainLength()); this._ticker = 0; this._running = (this._speed>0); return this; }
  skipAll(){ this._visible = this._plainLength(); this._running = false; this._render(); return this; }

  // -------- internal: style / font --------
  _applyFontStyles(forceSizeOnly=false){
    const cs = this._content.style;
    if (!forceSizeOnly) cs.font = this._font;
    cs.fontSize = this._fontSize + 'px';
    cs.lineHeight = (this._fontSize * this._lineHeight) + 'px';
    cs.color = this._color;
  }
  _parseFontSizePx(fontString){
    // "bold 16px system-ui, ..." → 16
    const m = /(^|\s)(\d+(?:\.\d+)?)px(\s|$)/.exec(fontString||'');
    return m ? Math.round(parseFloat(m[2])) : null;
  }

  // -------- internal: tokenize with [b]/[u] --------
  _tokenize(raw){
    const out = [];
    const stack = []; // e.g., [{b:true,u:false}]
    let state = { b:false, u:false };
    const pushState = ()=> stack.push({...state});
    const popState  = ()=> { const s=stack.pop(); state = s ? s : {b:false,u:false}; };

    // very small parser: supports [b],[/b],[u],[/u]
    // also keeps \n as special token {ch:'\n'}
    const tagRE = /\[\/?b\]|\[\/?u\]/gi;
    let last = 0, m;
    const emitPlain = (s)=>{
      for (const ch of s){
        out.push({ ch, b:state.b, u:state.u });
      }
    };
    while ((m = tagRE.exec(raw)) !== null){
      if (m.index > last) emitPlain(raw.slice(last, m.index));
      const tag = m[0].toLowerCase();
      if (tag === '[b]'){ pushState(); state.b = true; }
      else if (tag === '[/b]'){ popState(); }
      else if (tag === '[u]'){ pushState(); state.u = true; }
      else if (tag === '[/u]'){ popState(); }
      last = tagRE.lastIndex;
    }
    if (last < raw.length) emitPlain(raw.slice(last));
    // keep explicit newlines as tokens
    // (already included as chars above)

    return out;
  }
  _plainLength(){ return this._tokens.filter(t => t.ch !== '\r').length; }

  // -------- internal: layout (manual wrap + simple kinsoku) --------
  _render(){
    const maxChars = this._visible;
    const cs = getComputedStyle(this._content);
    const fontFamily = cs.fontFamily;
    const fontSize   = parseFloat(cs.fontSize) || this._fontSize;
    const lineHeight = parseFloat(cs.lineHeight) || (this._fontSize * this._lineHeight);

    // --- 禁則集合（最小・実用セット）---
    // 行頭に来てはダメ（句読点ほか）
    const HEAD_NG = new Set('、。，．・：；！？）」』】〕〉》’”％ゝゞー‐–—〜…‥)]!?,.:;’”』」】〕〉》％'.split(''));
    // 行末に来てはダメ（開き）
    const TAIL_NG = new Set('（「『【〔〈《‘“([｛{【〔〈《『「‘“'.split(''));

    // 計測（太字は fontWeight を適用して幅を測る）
    if (!this._measurer){
      this._measurer = document.createElement('span');
      const ms = this._measurer.style;
      ms.position='absolute'; ms.left='-99999px'; ms.top='-99999px';
      ms.whiteSpace='pre'; ms.visibility='hidden';
      document.body.appendChild(this._measurer);
    }
    const measureCh = (tok)=>{
      const el = this._measurer;
      el.style.fontFamily = fontFamily;
      el.style.fontSize   = fontSize + 'px';
      el.style.fontWeight = tok.b ? 'bold' : 'normal'; // 太字は幅に影響
      el.textContent = tok.ch;
      return el.getBoundingClientRect().width;
    };

    const maxW = this.width || this._element.clientWidth || 0;
    let shown = 0;
    let htmlLines = [];

    // 1行ぶんの状態
    let line = [];           // tokens
    let lineWidth = 0;       // measured
    let lastBreakIndex = -1; // 折り返してよい位置（行末禁則/行頭禁則に抵触しない位置）

    const flushLine = ()=>{
      // line[] → HTML（スタイル連結）
      let curB=null, curU=null, buf='';
      const dump=()=>{
        if (buf==='') return;
        const style = (curB?'font-weight:bold;':'') + (curU?'text-decoration:underline;':'');
        html.push(style?`<span style="${style}">${esc(buf)}</span>`:esc(buf));
        buf='';
      };
      const html = [];
      for (const t of line){
        if (t.ch === '\r') continue;
        if (curB === t.b && curU === t.u){ buf += t.ch; }
        else { dump(); curB = t.b; curU = t.u; buf = t.ch; }
      }
      dump();
      htmlLines.push(`<div>${html.join('')}</div>`);
      line=[]; lineWidth=0; lastBreakIndex=-1;
    };

    const considerBreakable = (prevCh, nextCh)=>{
      // 折返し許容の基本条件：
      //  - 直前文字が TAIL_NG でない（=「で行を終えない）
      //  - 次文字が HEAD_NG でない（=。」を次行頭に置かない）
      if (prevCh && TAIL_NG.has(prevCh)) return false;
      if (nextCh && HEAD_NG.has(nextCh)) return false;
      return true;
    };

    // 可視領域までのトークンを流し込む
    for (let i=0; i<this._tokens.length && shown<maxChars; i++){
      const tok = this._tokens[i];
      const ch = tok.ch;
      if (ch === '\r') continue;

      if (ch === '\n'){ // 明示改行
        flushLine(); shown++; continue;
      }

      const w = measureCh(tok);
      const will = lineWidth + w;

      // 直前/直後の文字を把握（禁則判定用）
      const prevCh = line.length ? line[line.length-1].ch : '';
      const nextCh = (i+1<this._tokens.length) ? this._tokens[i+1].ch : '';

      // はみ出す場合は改行を検討
      if (maxW>0 && will > maxW && line.length>0){
        // 行末禁則：末尾が開きの場合、1文字前で改行する（戻して次で処理）
        if (TAIL_NG.has(prevCh)){
          // 開き括弧を次行頭に送る
          const popped = line.pop(); lineWidth -= measureCh(popped);
          // pop した分はこのループで再処理
          i -= 1;
          flushLine();
          continue;
        }

        // 安全に切れる位置が既に分かっていれば、そこで切る
        if (lastBreakIndex >= 0){
          // lastBreakIndex までで1行
          const head = line.slice(0, lastBreakIndex+1);
          const tail = line.slice(lastBreakIndex+1);
          line = head; flushLine();
          // tail は次の行に繰り越す
          for (const t of tail){ line.push(t); lineWidth += measureCh(t); }
          // まだ ch を積んでいないので、このループで続行
          // 行頭禁則：もし次が「。」など HEAD_NG なら、可能なら ch とセットで積む
          if (HEAD_NG.has(ch)){
            const w2 = measureCh(tok);
            if (maxW>0 && w2 > maxW){
              // 単独でも収まらない…→ 仕方なく積む（見切れ防止）
            }
          }
          // ここから ch を通常処理で積む
        } else {
          // 戻れる候補がない → 強制改行
          flushLine();
        }
      }

      // 行頭禁則：行頭に HEAD_NG は置かない。置く場合は次文字も同時に入るか確認
      if (line.length===0 && HEAD_NG.has(ch)){
        const nxt = (i+1<this._tokens.length)? this._tokens[i+1]: null;
        if (nxt){
          const w2 = w + measureCh(nxt);
          if (maxW>0 && w2 <= maxW){
            line.push(tok); lineWidth += w; shown++;
            i++; line.push(nxt); lineWidth += measureCh(nxt); shown++;
            // 改行候補はこの 2 文字の間には作らない
            continue;
          }
          // 入らない場合は単独で許容（無限ループ防止）
        }
      }

      // ここまで来たら普通に積む
      line.push(tok); lineWidth += w; shown++;

      // 改行候補：今積んだ位置（i と i+1 の間）が禁則に触れないなら候補に
      if (considerBreakable(ch, nextCh)) lastBreakIndex = line.length - 1;
    }

    if (line.length) flushLine();
    this._content.innerHTML = htmlLines.join('');

    function esc(s){ return s.replace(/[&<>"']/g, c => c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='"'?'&quot;':'&#39;'); }
  }

}

// =============================
// FrameOverlay: 最前面フレーム（Core初期サイズにフィット／パーツ自動配置なし）
// =============================
export class FrameOverlay extends Group {
  /**
   * @param {string} preset  'simple' | 'arcade' | 'bezel' | 'rounded' | 'shadow-only'
   * @param {object} opts    { border, borderRadius, boxShadow, background }
   */
  constructor(preset='simple', opts={}){
    super();
    const st = this._element.style;
    this._element.classList.add('enchant-frame-overlay');
    st.pointerEvents = 'none';
    st.zIndex = '9999';
    st.left = '0px';
    st.top  = '0px';
    st.boxSizing = 'border-box'; // 外寸=width/height
    st.background = 'transparent';

    // Core 初期サイズにフィット（以後サイズは固定前提）
    const core = (typeof Core !== 'undefined') ? Core.instance : null;
    const W = core ? core.width  : (this.width  || 0);
    const H = core ? core.height : (this.height || 0);
    this.width  = W|0;
    this.height = H|0;

    // 画面最前面（stage直下）へ
    this.on(Event.ADDED_TO_SCENE, ()=>{
      const c = Core.instance;
      if (c && c._stage) c._stage.appendChild(this._element);
    });

    // 見た目プリセット適用
    this.usePreset(preset, opts);
  }

  /**
   * Coreの外寸に明示フィット（初期化後も手動で呼べます）
   * ※要件上 Core 幅高は不変前提なので、通常は不要
   */
  fitToCore(){
    const core = (typeof Core !== 'undefined') ? Core.instance : null;
    if (!core) return this;
    this.width  = core.width|0;
    this.height = core.height|0;
    return this;
  }

  /**
   * 見た目プリセット
   * @param {'simple'|'arcade'|'bezel'|'rounded'|'shadow-only'} name
   * @param {object} opts { border, borderRadius, boxShadow, background }
   */
  usePreset(name='simple', opts={}){
    const st = this._element.style;
    // reset
    st.background   = 'transparent';
    st.border       = '0';
    st.boxShadow    = 'inset 0 0 8px #111, 5px 5px 5px 15px ' +
                      getComputedStyle(document.body).backgroundColor;// 親要素の背景色のシャドウで隙間を覆う
    st.borderImage  = 'none';
    st.borderRadius = '';

    switch(name){
      case 'arcade':
        st.border = '12px solid #111';
        st.borderRadius = '10px';
        break;
      case 'bezel':
        st.border = '18px solid rgb(127, 90, 172)';
        st.borderRadius = '8px';
        break;
      case 'rounded':
        st.border = '8px solid #222';
        st.boxShadow = '0 4px 16px rgba(0,0,0,.4)';
        st.borderRadius = '20px';
        break;
      case 'shadow-only':
        st.boxShadow = '0 8px 24px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.05)';
        break;
      default: // simple
        st.border = '6px solid #000';
        st.borderRadius = '6px';
    }
    // 任意上書き
    if (opts.border)             st.border       = opts.border;
    if (opts.borderRadius != null) st.borderRadius = (opts.borderRadius|0)+'px';
    if (opts.boxShadow)          st.boxShadow    = opts.boxShadow;
    if (opts.background)         st.background   = opts.background;
    return this;
  }

  /**
   * 9-slice画像フレーム
   * @param {string} url
   * @param {number} slice 例: 24
   * @param {'stretch'|'repeat'|'round'} repeat
   */
  useImageFrame(url, slice=24, repeat='stretch'){
    const st = this._element.style;
    st.borderWidth       = `${slice|0}px`;
    st.borderStyle       = 'solid';
    st.borderImageSource = `url("${url}")`;
    st.borderImageSlice  = String(slice|0);
    st.borderImageRepeat = repeat;
    return this;
  }

  /** 最前面へ（他UIを後から足した後などに明示呼び出し） */
  bringToFront(){
    const core = (typeof Core !== 'undefined') ? Core.instance : null;
    if (core && core._stage){
      core._stage.appendChild(this._element);
    }
  }

  /**
   * 追加パーツ（自動配置なし）：x/y はユーザーが直接設定してください
   * @param {Node} node
   */
  addPart(node){
    // 透過ヒットにしたい場合は pointerEvents を off に
    if (node && node._element) node._element.style.pointerEvents = 'none';
    this.addChild(node);
    return node;
  }
}



// =============================
// FrameOverlay: 最前面フレーム（borderはそのまま表示／partsはfitToCoreで自動再配置）
// =============================




// export class FrameOverlay extends Group {
//   constructor(){
//     super();
//     const st = this._element.style;
//     this._element.classList.add('enchant-frame-overlay');
//     st.pointerEvents = 'none';
//     st.zIndex = '9999';
//     st.left = '0px';
//     st.top  = '0px';
//     st.boxSizing = 'border-box';   // 外寸=width/height

//     this._autoFit = true;
//     this._parts = new Map();       // name -> { node, anchor, offsetX, offsetY, inside, followRadius }

//     // シーンに入ったら：DOM上は stage 直下（最前面）へ移動し、初回フィット
//     this.on(Event.ADDED_TO_SCENE, ()=>{
//       const core = Core.instance;
//       if (core && core._stage) core._stage.appendChild(this._element);
//       if (this._autoFit) this.fitToCore();
//     });

//     // Coreリサイズに追従
//     const core = Core.instance;
//     if (core){
//       core.on(Event.CORE_RESIZE, (e)=>{
//         if (this._autoFit) this.fitToCore(e.width, e.height);
//       });
//     }
//   }

//   // ---- 公開API -------------------------------------------------

//   /**
//    * Coreの外寸にフィット（box-sizing:border-box なので border込みで一致）
//    * borderやborder-radiusが変わってもpartsを再レイアウト
//    */
//   fitToCore(w, h){
//     const core = Core.instance;
//     const W = (w!=null ? w : (core ? core.width  : this.width  || 0))|0;
//     const H = (h!=null ? h : (core ? core.height : this.height || 0))|0;
//     this.width  = W;
//     this.height = H;
//     this._layoutParts();
//     return this;
//   }

//   /**
//    * 見た目プリセット
//    * @param {'simple'|'arcade'|'bezel'|'rounded'|'shadow-only'} name
//    * @param {object} opts 例: { border, borderRadius, boxShadow, background }
//    */
//   usePreset(name='simple', opts={}){
//     const st = this._element.style;
//     // reset
//     st.background   = 'transparent';
//     st.border       = '0';
//     //st.boxShadow    = 'inset 0 0 8px #111, 5px 5px 5px 15px #333';//'none';
//     st.boxShadow    = 'inset 0 0 8px #111, 5px 5px 5px 15px '+getComputedStyle(document.body).backgroundColor;//'none';
//     //getComputedStyle(document.body).backgroundColor
//     st.borderImage  = 'none';
//     st.borderRadius = '';

//     switch(name){
//       case 'arcade':
//         st.border = '12px solid #111';
//         //st.boxShadow = 'inset 0 0 20px rgba(255,255,255,.06), 0 0 12px rgba(0,0,0,.6)';
//         //st.boxShadow = 'inset 0 0 8px #111, 5px 5px 5px 15px #333';
//         st.borderRadius = '10px';
//         break;
//       case 'bezel':
//         st.border = '18px solid rgb(127, 90, 172)';
//         //st.boxShadow = 'inset 0 6px 12px rgba(56, 23, 23, 0.08), inset 0 -6px 12px rgba(0,0,0,.3)';
//         st.borderRadius = '8px';
//         break;
//       case 'rounded':
//         st.border = '8px solid #222';
//         //st.borderRadius = '20px';
//         st.boxShadow = '0 4px 16px rgba(0,0,0,.4)';
//         break;
//       case 'shadow-only':
//         st.boxShadow = '0 8px 24px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.05)';
//         break;
//       default: // simple
//         st.border = '6px solid #000';
//         //st.boxShadow = '0 6px 18px rgba(0,0,0,.45)';
//         st.borderRadius = '6px';
//     }
//     // 任意上書き
//     if (opts.border)        st.border = opts.border;
//     if (opts.borderRadius!=null) st.borderRadius = (opts.borderRadius|0)+'px';
//     if (opts.boxShadow)     st.boxShadow = opts.boxShadow;
//     if (opts.background)    st.background = opts.background;

//     // 見た目変更後もCoreに外寸を合わせつつparts再レイアウト
//     if (this._autoFit) this.fitToCore();
//     return this;
//   }

//   /**
//    * 9-slice画像フレーム
//    * @param {string} url
//    * @param {number} slice 例: 24
//    * @param {'stretch'|'repeat'|'round'} repeat
//    */
//   useImageFrame(url, slice=24, repeat='stretch'){
//     const st = this._element.style;
//     st.borderWidth     = `${slice|0}px`;
//     st.borderStyle     = 'solid';
//     st.borderImageSource = `url("${url}")`;
//     st.borderImageSlice  = String(slice|0);
//     st.borderImageRepeat = repeat;
//     if (this._autoFit) this.fitToCore();
//     return this;
//   }

//   /**
//    * 部品を配置（fitToCore時に常に自動再配置）
//    * @param {string} name
//    * @param {Node} node
//    * @param {object} opt
//    *   - anchor: 'tl'|'tr'|'bl'|'br'|'t'|'b'|'l'|'r'|'center'
//    *   - offsetX/offsetY: 数値。**内側方向を正**とする（outside時は通常のXY）
//    *   - inside: true=内側（既定） / false=外側
//    *   - followRadius: true=角丸半径ぶん内側に寄せる（既定）
//    */
//   putPart(name, node, opt={}){
//     const meta = {
//       node,
//       anchor: opt.anchor || 'tl',
//       offsetX: opt.offsetX|0 || 0,
//       offsetY: opt.offsetY|0 || 0,
//       inside: opt.inside !== false,
//       followRadius: opt.followRadius !== false
//     };
//     this._parts.set(name, meta);
//     node._element.style.pointerEvents = 'none';
//     this.addChild(node);
//     this._layoutParts(); // 即1回配置
//     return node;
//   }

//   /** 最前面へ（他UIを後から足した後などに明示呼び出し） */
//   bringToFront(){
//     const core = Core.instance;
//     if (core && core._stage){
//       core._stage.appendChild(this._element);
//     }
//   }

//   // ---- 内部：計測 & レイアウト ----------------------------------

//   _metrics(){
//     // getComputedStyle で実寸を取る（border幅/角丸/外寸）
//     const cs = getComputedStyle(this._element);
//     const bw = {
//       l: parseFloat(cs.borderLeftWidth)   || 0,
//       r: parseFloat(cs.borderRightWidth)  || 0,
//       t: parseFloat(cs.borderTopWidth)    || 0,
//       b: parseFloat(cs.borderBottomWidth) || 0
//     };
//     // 角丸：簡易に1値（必要なら各コーナー別にも拡張可）
//     const br = parseFloat(cs.borderTopLeftRadius) || parseFloat(cs.borderRadius) || 0;
//     return { bw, br, W:this.width|0, H:this.height|0 };
//   }

//   _layoutParts(){
//     const { bw, br, W, H } = this._metrics();
//     for (const [,m] of this._parts){
//       const n = m.node;
//       const w = (n.width|0), h = (n.height|0);
//       const rx = m.followRadius ? br : 0;
//       const ry = m.followRadius ? br : 0;
//       let x = 0, y = 0;

//       // アンカー基準のベース位置
//       switch(m.anchor){
//         case 'tl': x = (m.inside? bw.l + rx : -w - bw.l);
//                    y = (m.inside? bw.t + ry : -h - bw.t); break;
//         case 'tr': x = (m.inside? W - w - bw.r - rx : W + bw.r);
//                    y = (m.inside? bw.t + ry : -h - bw.t); break;
//         case 'bl': x = (m.inside? bw.l + rx : -w - bw.l);
//                    y = (m.inside? H - h - bw.b - ry : H + bw.b); break;
//         case 'br': x = (m.inside? W - w - bw.r - rx : W + bw.r);
//                    y = (m.inside? H - h - bw.b - ry : H + bw.b); break;
//         case 't' : x = Math.round((W - w)/2);
//                    y = (m.inside? bw.t + ry : -h - bw.t); break;
//         case 'b' : x = Math.round((W - w)/2);
//                    y = (m.inside? H - h - bw.b - ry : H + bw.b); break;
//         case 'l' : x = (m.inside? bw.l + rx : -w - bw.l);
//                    y = Math.round((H - h)/2); break;
//         case 'r' : x = (m.inside? W - w - bw.r - rx : W + bw.r);
//                    y = Math.round((H - h)/2); break;
//         default  : x = Math.round((W - w)/2);
//                    y = Math.round((H - h)/2); break;
//       }

//       // ---- オフセットを「内側に正」で解釈（outside=falseのときは通常XY）----
//       const ox = m.offsetX|0, oy = m.offsetY|0;
//       if (m.inside !== false){
//         switch(m.anchor){
//           case 'tl': x +=  ox; y +=  oy; break;
//           case 'tr': x -=  ox; y +=  oy; break;
//           case 'bl': x +=  ox; y -=  oy; break;
//           case 'br': x -=  ox; y -=  oy; break;
//           case 't' : x +=  ox; y +=  oy; break;
//           case 'b' : x +=  ox; y -=  oy; break;
//           case 'l' : x +=  ox; y +=  oy; break;
//           case 'r' : x -=  ox; y +=  oy; break;
//           default  : x +=  ox; y +=  oy; break;
//         }
//       } else {
//         x += ox; y += oy;
//       }

//       n.x = Math.round(x);
//       n.y = Math.round(y);
//     }
//   }
// }