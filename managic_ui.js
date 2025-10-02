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


// =====================================================
// CharSprite — JRPG風「立ち絵」用：差分・感情・演出まとめて
// 依存: managic_dom(enchant-dom) の Group/Sprite/Label/Core/Event/Timeline
// 使い方:
//   const ch = new CharSprite('elfRanger', { baseDir:'./assets/chara', width:320, height:360, fit:true });
//   scene.addChild(ch);
//   ch.setDiff('smile');             // chara_elfRanger_smile.png に切替
//   ch.showEmotion('💢', { x:260, y:24, anim:'pop' });
//   ch.animAttack();                 // プリセット演出
//   ch.animFadeIn(20);
// =====================================================
export class CharSprite extends Group {
  /**
   * @param {string} name  例: 'elfRanger'
   * @param {object} opts
   *   - baseDir: 画像ディレクトリ（末尾スラ不要）例 './assets/chara'
   *   - width,height: CharSprite 自体の枠サイズ（fit=true時のターゲット）
   *   - defaultDiff: 初期差分（既定 'default'）
   *   - fit: true で「大きいときだけ縮小」して枠に収める（既定 true / 拡大はしない）
   */
  constructor(name, opts = {}) {
    super();
    this.name = name;
    this.baseDir = opts.baseDir || './assets/chara';
    this._w = opts.width | 0 || 0;
    this._h = opts.height | 0 || 0;
    if (this._w) this.width = this._w;
    if (this._h) this.height = this._h;

    this.fit = opts.fit !== false; // 既定ON（拡大はしない）
    this.defaultDiff = opts.defaultDiff || 'default';

    // this.bg = new Sprite(opts.width, opts.height);
    // this.bg.backgroundColor = '#f00';
    // this.addChild(this.bg);

    // (0) フレームはクリップ（枠外を隠す）
    this._element.style.overflow = 'hidden';
    // (1) 中央アンカー用ピボット（ここを枠の“中心”に置く）
    this._pivot = new Group();
    this.addChild(this._pivot);
    // (2) body は 0x0 で作る（画像ロード後に natural へ更新）
    this.body = new Sprite(0, 0);
    this.body._shrink = 1;
    // this.body.backgroundColor = '#0f0';
    this.addChild(this.body);

    this._emo = null;
    this._diffs = new Set();

    // 初期差分セット
    this.setDiff(this.defaultDiff);

    // シーンに入ったタイミングでもフィット
    this.on(Event.ADDED_TO_SCENE, () => this._applyFit());
  }

  // -------- 公開API --------
  setSize(w, h) {
    this._w = w | 0;
    this._h = h | 0;
    this.width = this._w;
    this.height = this._h;
    this._applyFit();
    return this;
  }

  setDiff(diffName) {
    const urls = this._buildUrl(this.name, diffName);
    this._diffs.add(diffName);
    this._setImage(urls);
    return this;
  }

  listDiffsFromAssets() {
    const core = Core.instance;
    if (!core) return Array.from(this._diffs);
    const re = new RegExp(`(?:^|/)char(?:a)?_${this.name}_(\\w+)\\.png$`, 'i');
    Object.keys(core.assets || {}).forEach((k) => {
      const m = re.exec(k);
      if (m) this._diffs.add(m[1]);
    });
    return Array.from(this._diffs);
  }

  showEmotion(what, opt = {}) {
    if (this._emo) {
      this.removeChild(this._emo);
      this._emo = null;
    }
    if (what instanceof Sprite || what instanceof Label) {
      this._emo = what;
    } else if (
      typeof what === 'string' &&
      (/^data:|\.png$|\.jpg$|\.jpeg$|\.webp$|^https?:/i.test(what))
    ) {
      const sp = new Sprite(32, 32);
      sp.image = what;
      this._emo = sp;
    } else {
      const lb = new Label(String(what));
      lb.font = 'bold 40px system-ui, sans-serif';
      lb.color = '#fff';
      lb._element.style.textShadow = '0 2px 8px rgba(0,0,0,.5)';
      lb.fitToTextWidth = true;
      this._emo = lb;
    }
    // アイコン 💢🩷💡💔💕✨🔥💧🩸💀😡😠🤢💰🍖🍔🌐❄🎃👻🎄🎁🎖️🔊🔇🔔
    this.addChild(this._emo);
    // const fw = this.width  || this._w || 0;
    // const fh = this.height || this._h || 0;
    // 既定は「枠の右上」（pivot は中心基準）
    // const defX = Math.round((fw/2) - 140);
    // const defY = Math.round(-(fh/2) + 120);
    // this._emo.x = (opt.x != null) ? (opt.x|0) : defX;
    // this._emo.y = (opt.y != null) ? (opt.y|0) : defY;
    this._emo.x = this.width*0.1;
    this._emo.y = this.height*0.1;
    this._emo.opacity = 1;
    this._emo.tl.clear();

    const dur = opt.duration | 0 || 24;
    switch (opt.anim) {
      case 'pop':
        this._emo.scaleX = this._emo.scaleY = 1;
        this._emo.opacity = 0;
        this._emo.y += 50;
        this._emo.tl.fadeTo(1, 6).and().moveBy(0, -50, 6)
        .delay(30)
        .moveBy(0,-50,6).and().fadeTo(0,6);
        break;
      case 'bounce':
        this._emo.tl
          .moveBy(0, -12, dur / 3)
          .moveBy(0, 12, dur / 3)
          .moveBy(0, -6, dur / 6)
          .moveBy(0, 6, dur / 6)
          .then(()=> this.hideEmotion());
        break;
      case 'shake':
        for (let i = 0; i < 4; i++) {
          this._emo.tl.moveBy(3, 0, 2).moveBy(-6, 0, 4).moveBy(3, 0, 2);
        }
        this.hideEmotion();
        break;
      default:
        break;
    }
    return this._emo;
  }
  hideEmotion() {
    if (this._emo) {
      this._emo.remove();
      this._emo = null;
    }
  }

  animFadeIn(frames = 15) {
    this.opacity = 0;
    this.tl.fadeTo(1, frames);
    return this;
  }
  animFadeOut(frames = 15) {
    this.tl.fadeTo(0, frames);
    return this;
  }
  animAttack() {
    this.tl.clear();
    this.scaleX = this.scaleY = 1.0;
    this.tl.scaleTo(1.2, 1.2, 3).scaleTo(1.0, 1.0, 6);
    return this;
  }
  animDamaged() {
    this.tl.clear();
    this.tl
      .scaleTo(0.92, 0.92, 3)
      .fadeTo(0, 3)
      .fadeTo(1, 3)
      .fadeTo(0, 3)
      .fadeTo(1, 3)
      .scaleTo(1.0, 1.0, 6)
    return this;
  }
  animShake(frames = 20, amp = 6) {
    this.tl.clear();
    for (let i = 0; i < Math.max(1, frames / 4); i++) {
      this.tl.moveBy(amp, 0, 2).moveBy(-2 * amp, 0, 4).moveBy(amp, 0, 2);
    }
    return this;
  }
  animSlideInLeft(dist = 80, frames = 18) {
    this.moveBy(-dist, 0);
    this.opacity = 0.001;
    this.tl.moveBy(dist, 0, frames).and().fadeTo(1, frames);
    return this;
  }
  animSlideOutRight(dist = 80, frames = 18) {
    this.tl.moveBy(dist, 0, frames).and().fadeTo(0, frames);
    return this;
  }
  animSlideInBottom(dist = 80, frames = 18) {
    this.moveBy(0, dist);
    this.opacity = 0.001;
    this.tl.moveBy(0, -dist, frames).and().fadeTo(1, frames);
    return this;
  }
  animSlideInTop(dist = 120, frames = 18) {
    this.moveBy(0, -dist);
    this.opacity = 0.001;
    this.tl.moveBy(0, dist, frames).and().fadeTo(1, frames);
    return this;
  }
  animSlideOutBottom(dist = 80, frames = 18) {
    this.tl.moveBy(0, dist, frames).and().fadeTo(0, frames);
    return this;
  }
  animSlideOutTop(dist = 120, frames = 18) {
    this.tl.moveBy(0, -dist, frames).and().fadeTo(0, frames);
    return this;
  }

  // -------- 内部実装 --------
  _buildUrl(name, diff) {
    const a = `${this.baseDir}/chara_${name}_${diff}.png`;
    const b = `${this.baseDir}/char_${name}_${diff}.png`;
    return [a, b];
  }

  _setImage(urlOrArr) {
    const tryList = Array.isArray(urlOrArr) ? urlOrArr : [urlOrArr];
    const core = Core.instance;

    const applyNaturalSizeAndFit = (imgEl) => {
      // (1) body を画像の自然サイズに合わせる（必ず natural を入れる）
      const natW = imgEl.naturalWidth || imgEl.width || 0;
      const natH = imgEl.naturalHeight || imgEl.height || 0;
      this.body.width = natW;
      this.body.height = natH;
      // Sprite 側にも natural を反映（フレーム系の内部で参照）
      this.body._sheetWidth = natW;
      this.body._sheetHeight = natH;

      // (2)(3) フィット＆中央寄せ
      this._applyFit();
    };

    // Core.assets を優先
    for (const u of tryList) {
      const asset = core && core.assets ? core.assets[u] : null;
      if (asset && asset.src) {
        this.body.image = asset; // enchant-dom の Sprite が onload で _sheetW/H を埋める
        if (asset.complete) applyNaturalSizeAndFit(asset);
        else this.body._imgEl.onload = () => applyNaturalSizeAndFit(this.body._imgEl);
        return;
      }
    }

    // asset に無ければ遅延ロード
    const tryNext = (i) => {
      if (i >= tryList.length) return;
      const u = tryList[i];
      const test = new Image();
      test.onload = () => {
        this.body.image = test;
        applyNaturalSizeAndFit(test);
      };
      test.onerror = () => tryNext(i + 1);
      test.src = u;
    };
    tryNext(0);
  }

  _applyFit() {
    // ターゲット枠（CharSprite の外寸）
    const targetW = (this._w || this.width || this.body.width || 0)|0;
    const targetH = (this._h || this.height || this.body.height || 0)|0;
    if (!targetW || !targetH) return;

    // フレームサイズを確定
    this.width  = targetW;
    this.height = targetH;

    // ピボットは枠の“中心”へ
    this._pivot.x = targetW / 2;
    this._pivot.y = targetH / 2;

    // 画像の自然サイズ（body は natural を width/height に保持している）
    const natW = this.body.width  || 0;
    const natH = this.body.height || 0;
    if (!natW || !natH) {
      // 画像未ロード時は原点に置いておく
      this.body.x = 0; this.body.y = 0;
      this.body.scaleX = this.body.scaleY = 1;
      return;
    }

    if (this.fit === false) {
      // 等倍・中央寄せのみ
      this.body.scaleX = this.body.scaleY = 1;
      this.body.x = -(Math.round(natW / 2));  // ★中心基準
      this.body.y = -(Math.round(natH / 2));  // ★中心基準
      return;
    }

    // （2）拡大はしない（大きいときだけ縮小）
    const sx = targetW / natW;
    const sy = targetH / natH;
    const s  = Math.min(1, sx, sy);
    if(s < 1){
      this.body._shrink = s;
    }
    this.body.scaleX = this.body.scaleY = s;

    // （3）中央寄せ（中心基準の式に修正）
    this.body.x = -(Math.round((natW * s) / 2));
    this.body.y = -(Math.round((natH * s) / 2));
  }
}

export class StatusBar extends Group {
  /**
   * @param {'gauge'|'tokens'} type
   * @param {object} opt
   *   共通: { width,height, x,y, label, labelAlign:'left'|'top'|'right'|'bottom', font, color }
   *   値:   { max:100, value:100, animateFrames:8 }
   *   ゲージ: { bgColor:'#333', barColor:'#e33', border:'1px solid #000', radius:6, padding:4, showValue:true }
   *   トークン:{ symbolFilled:'🩷', symbolEmpty:'♡', tokenSize:24, spacing:4, perRow:Infinity }
   */
  constructor(type='gauge', opt={}){
    super();
    this.type = type;

    // ---- 共通設定 ----
    this._w = opt.width  || 200;
    this._h = opt.height || (type==='gauge' ? 20 : 28);
    this.width  = this._w;
    this.height = this._h;
    if (opt.x!=null) this.x = opt.x|0;
    if (opt.y!=null) this.y = opt.y|0;

    this.max   = (opt.max!=null ? +opt.max : 100);
    this.value = (opt.value!=null ? +opt.value : this.max);
    this.animateFrames = (opt.animateFrames!=null ? +opt.animateFrames : 8);

    // ラベル（“何のバーか”の説明）
    this.label = new Label(opt.label || '');
    this.label.font = opt.font || 'bold 14px system-ui, sans-serif';
    this.label.color = opt.color || '#fff';
    this.label._element.style.pointerEvents = 'none';
    this.addChild(this.label);

    this.labelAlign = opt.labelAlign || 'left';

    // ---- ゲージ型UI ----
    if (this.type === 'gauge'){
      this.padding = (opt.padding!=null ? +opt.padding : 4);

      this.bg = new Entity(this._w, this._h);
      const bgst = this.bg._element.style;
      bgst.boxSizing = 'border-box';
      bgst.background = opt.bgColor || '#2b2b2b';
      bgst.border = opt.border || '1px solid rgba(0,0,0,.6)';
      bgst.borderRadius = (opt.radius!=null ? opt.radius|0 : 6) + 'px';
      this.addChild(this.bg);

      // 内側のバー（width を伸縮）
      const innerH = Math.max(2, this._h - this.padding*2);
      this.bar = new Entity(Math.max(0, this._w - this.padding*2), innerH);
      const brst = this.bar._element.style;
      brst.left = this.padding + 'px';
      brst.top  = this.padding + 'px';
      brst.background = opt.barColor || '#e33';
      brst.borderRadius = (opt.radius!=null ? Math.max(0, (opt.radius|0)-1) : 5) + 'px';
      brst.transition = ''; // アニメは tl を使う
      this.addChild(this.bar);

      // 数値のオーバーレイ表示（任意）
      this.showValue = opt.showValue !== false;
      if (this.showValue){
        this.valueLabel = new Label('');
        this.valueLabel.font = opt.font || 'bold 12px system-ui, sans-serif';
        this.valueLabel.color = opt.valueColor || '#fff';
        this.valueLabel._element.style.textShadow = '0 1px 2px rgba(0,0,0,.55)';
        this.addChild(this.valueLabel);
      }

      this._layoutGauge();
      this._renderGauge(false);
    }
    // ---- トークン型UI ----
    else {
      this.symbolFilled = opt.symbolFilled || '🩷';
      this.symbolEmpty  = (opt.symbolEmpty  != null ? opt.symbolEmpty : '');
      this.tokenSize = (opt.tokenSize!=null ? +opt.tokenSize : 24);
      this.spacing   = (opt.spacing!=null ? +opt.spacing : 4);
      this.perRow    = (opt.perRow!=null ? +opt.perRow : Infinity);

      this.tokensGroup = new Group();
      this.addChild(this.tokensGroup);

      this._layoutTokens();
      this._renderTokens(false);
    }

    // label の初期配置
    this._layoutLabel();
  }

  // ================= 公開 API ================
  setMax(max){ this.max = Math.max(0, +max||0); this.value = Math.min(this.value, this.max); this._render(true); return this; }
  setValue(v, animate=true){ this.value = Math.max(0, Math.min(+v||0, this.max)); this._render(animate); return this; }
  addValue(d, animate=true){ return this.setValue(this.value + (+d||0), animate); }
  setLabel(text){ this.label.text = text||''; this._layoutLabel(); return this; }

  setColors({ bgColor, barColor }={}){
    if (this.type==='gauge'){
      if (bgColor!=null) this.bg._element.style.background = bgColor;
      if (barColor!=null) this.bar._element.style.background = barColor;
    }
    return this;
  }

  // ================= 内部：レイアウト =================
  _layoutLabel(){
    const pad = 4;
    switch (this.labelAlign){
      case 'top':
        this.label.x = 0;
        this.label.y = -(this.label.height + pad);
        break;
      case 'right':
        this.label.x = this._w + pad;
        this.label.y = Math.round((this._h - this.label.height)/2);
        break;
      case 'bottom':
        this.label.x = 0;
        this.label.y = this._h + pad;
        break;
      default: // left
        this.label.x = -(this.label.width + pad);
        this.label.y = Math.round((this._h - this.label.height)/2);
        break;
    }
  }

  _render(animate){
    if (this.type==='gauge') this._renderGauge(animate);
    else this._renderTokens(animate);
  }

  // ---------- ゲージ ----------
  _layoutGauge(){
    this.bg.width = this._w;  this.bg.height = this._h;
    this.bar.height = Math.max(2, this._h - this.padding*2);
    this.bar.y = 0;//this.padding;
    this.bar.x = 0;//this.padding;
    this.bar.defaultX = this.bar.x;
    if (this.valueLabel){
      this.valueLabel.x = 0;
      this.valueLabel.y = Math.round((this._h - this.valueLabel.height)/2) - 1;
      this.valueLabel.width = this._w;
      this.valueLabel.textAlign = 'center';
    }
  }

  _renderGauge(animate){
    const usableW = Math.max(0, this._w - this.padding*2);
    const ratio   = (this.max>0 ? this.value/this.max : 0);
    const targetW = Math.round(usableW * Math.max(0, Math.min(1, ratio)));
    const frames  = (animate ? Math.max(1, this.animateFrames) : 1);

    // width を補間
    if (animate){
      this.bar.tl.clear();
      if (typeof this.bar.tl._tween === 'function') {
        this.bar.tl.scaleTo(targetW/usableW, 1, frames).and().moveTo((this.bar.defaultX + (targetW-usableW)/2), 0, frames);
      } else {
        this.bar.width = targetW
      }
    } else {
      // tl が無い/animate=false の場合は即時反映
      this.bar.width = targetW;
    }

    if (this.valueLabel){
      this.valueLabel.text = `${this.value}/${this.max}`;
    }
  }

  // ---------- トークン ----------
  _layoutTokens(){
    // tokensGroup の原点に並べる
    this.tokensGroup.x = 0;
    this.tokensGroup.y = 0;
  }

  _renderTokens(animate){
    // 子を作り直す（シンプルで安定）
    const g = this.tokensGroup;
    while (g.childNodes.length) g.removeChild(g.childNodes[0]);

    const filled = Math.max(0, Math.min(this.value|0, this.max|0));
    const empty  = Math.max(0, (this.max|0) - filled);
    const symF = this.symbolFilled, symE = this.symbolEmpty;
    const size = this.tokenSize|0, gap = this.spacing|0, per = (this.perRow|0) || Infinity;

    let row=0, col=0;
    const make = (ch, idx, isFilled)=>{
      const lb = new Label(ch);
      lb.font = `bold ${size}px system-ui, sans-serif`;
      lb.fitToTextWidth = true;
      lb.y = row * (size + gap);
      lb.x = col * (size + gap);
      g.addChild(lb);

      // ちょっとしたアニメ：増加時はポップ、減少時はフェード
      if (animate){
        lb.opacity = 0;
        lb.scaleX = lb.scaleY = 0.6;
        lb.tl.fadeTo(1, 6).and().scaleTo(1, 1, 8);
      }
      col++;
      if (col>=per){ col=0; row++; }
    };

    for (let i=0;i<filled;i++) make(symF, i, true);
    for (let i=0;i<empty;i++)  if (symE) make(symE, filled+i, false);

    // 高さを自動で更新（複数行のとき）
    const rows = row + (col>0?1:0);
    this.height = (rows>0 ? rows*(size+gap)-gap : size);
    this._h = this.height;
  }
}

