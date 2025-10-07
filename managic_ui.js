// managic_ui.js — UI helpers for managic_dom.js (ESM, no dependencies)
import { Core, Group, Scene, Entity, Sprite, Label, Event, loadGoogleFont } from './managic_dom.js';

/**
 * このファイルに含まれるクラス名一覧
 * FrameWindow, CharSprite, UIButton, 
 * LabelArea, StatusBar, FrameOverlay, 
 * AnimatedCover, LoadingScene, MenuScene
 */

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
      standard: {
        background: '#333', border: '1px solid #cfd8dc',
        radius: 8, shadow: '0 2px 8px rgba(0,0,0,.12)'
      },
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

  static registerFontPreset(name, config){ return Label.registerFontPreset(name, config); }
  static getFontPreset(name){ return Label.getFontPreset(name); }
  static listFontPresets(includeAliases=false){ return Label.listFontPresets(includeAliases); }

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

  async useFontPreset(name, overrides={}){
    const resolved = Label.resolveFontPresetOptions(name, overrides, this._fontSize);
    if (!resolved){
      console.warn(`[LabelArea] Unknown font preset: ${name}`);
      return this;
    }
    const { preset, font, fontSizePx, lineHeightValue, lineHeightCss, letterSpacing, google } = resolved;
    if (google) await loadGoogleFont(preset.family, google);
    this._font = font;
    if (typeof fontSizePx === 'number' && isFinite(fontSizePx)) {
      this._fontSize = fontSizePx;
    }
    if (typeof lineHeightValue === 'number') {
      this._lineHeight = lineHeightValue;
    } else if (lineHeightCss && /px$/i.test(lineHeightCss) && typeof this._fontSize === 'number' && this._fontSize) {
      const px = parseFloat(lineHeightCss);
      if (!Number.isNaN(px) && this._fontSize) this._lineHeight = +(px / this._fontSize);
    }
    this._applyFontStyles();
    if (letterSpacing !== undefined) {
      this._content.style.letterSpacing = letterSpacing === null ? '' : letterSpacing;
    } else if (this._fontPreset) {
      this._content.style.letterSpacing = '';
    }
    const overridesCopy = (overrides && typeof overrides === 'object') ? { ...overrides } : overrides;
    this._fontPreset = { name: preset.name, overrides: overridesCopy };
    this._render();
    return this;
  }

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
    st.boxShadow    = 'inset 0 0 8px #aaa, 5px 5px 5px 15px ' + getComputedStyle(document.body).backgroundColor;// 親要素の背景色のシャドウで隙間を覆う
    st.borderImage  = 'none';
    st.borderRadius = '';

    switch(name){
      case 'arcade':
        st.border = '12px solid #111';
        st.borderRadius = '10px';
        break;
      case 'bezel':
        st.border = '18px solid rgb(127, 90, 172)';1
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


// =============================
// AnimatedCover — シーンや任意領域を覆って演出フラッシュ/暗転などを再生
// =============================
export class AnimatedCover extends Entity {
  /**
   * @param {number} [width]   覆いの幅（未指定なら Core の幅）
   * @param {number} [height]  覆いの高さ（未指定なら Core の高さ）
   * @param {object} [opts]
   *   - color:        '#000' | 'rgba(0,0,0,.5)' など（既定: 黒 0.7）
   *   - blendMode:    CSS mix-blend-mode（'multiply' 'screen' 等）
   *   - zIndex:       前面表示したい場合に数値で（既定: 9998）
   *   - autoMount:    true なら作成時に rootScene へ追加（既定 true）
   * 
  1) シーン全体を赤フラッシュ（被ダメ）
  AnimatedCover.play('hit', { frames: 12, peak: 0.7 });

  2) 白フラッシュ（与ダメ）
  scene.tl.delay(30).then(()=> AnimatedCover.play('attack', { frames: 10, peak: 0.6 }));

  3) 暗転 → 1秒置いてフェードアウト
  scene.tl.delay(60).then(()=>{
    const cov = new AnimatedCover(); // 自動で rootScene に追加＆フィット
    cov.bringToFront().play('darken', { to: 1, frames: 20, keep: true, autoRemove:false });
    scene.tl.delay(30).then(()=> cov.play('fadeout', { frames: 20 })); // remove は自動
  });

  4) 任意のスプライト領域だけ点滅
  AnimatedCover.playOnNode(playerSprite, 'blink', { times: 3, frames: 12, peak: 0.8, pad: 4 });
   */
  constructor(width, height, opts={}){
    const core = Core.instance;
    const W = (width  != null) ? width  : (core ? core.width  : 0);
    const H = (height != null) ? height : (core ? core.height : 0);
    super(W, H);

    this._element.classList.add('enchant-animated-cover');
    const st = this._element.style;
    st.pointerEvents = 'none';
    st.left = '0px';
    st.top  = '0px';
    st.boxSizing = 'border-box';
    st.zIndex = String(opts.zIndex != null ? opts.zIndex : 9998);

    this.setColor(opts.color || 'rgba(0,0,0,0.7)');
    if (opts.blendMode) st.mixBlendMode = opts.blendMode;

    // 初期は非表示
    this.opacity = 0;

    // デフォはシーン全体に追従
    if (opts.autoMount !== false && core && core.currentScene){
      core.currentScene.addChild(this);
      this.fitToScene();
    }
  }

  // ---- 配置ヘルパ ----
  /** 現在の Scene の外寸にフィット（Core を参照） */
  fitToScene(){
    const core = Core.instance;
    if (!core) return this;
    this.width = core.width; this.height = core.height;
    this.x = 0; this.y = 0;
    return this;
  }

  /**
   * 任意ノード（Sprite/Label/Entity）の矩形を覆う
   * 親は Scene 推奨（座標系が安定する）
   */
  fitToNode(node, pad=0){
    const r = node.getBoundingRect();
    this.width  = Math.max(0, Math.round(r.width  + pad*2));
    this.height = Math.max(0, Math.round(r.height + pad*2));
    this.x = Math.round(r.x - pad);
    this.y = Math.round(r.y - pad);
    return this;
  }

  /** 単色/アルファをまとめて設定 */
  setColor(color){
    this._element.style.background = color || 'transparent';
    return this;
  }

  /** 最前面に */
  bringToFront(){
    const core = Core.instance;
    if (core && core._stage){
      core._stage.appendChild(this._element);
    }
    return this;
  }

  // ---- 演出再生 ----
  /**
   * @param {'hit'|'attack'|'darken'|'lighten'|'blink'|'fadein'|'fadeout'} type
   * @param {object} [opt]
   *   - frames:      速度（既定: 12）
   *   - keep:        true なら最後の状態を保持（暗転など）
   *   - color:       覆い色の上書き
   *   - times:       blink の回数（既定 2）
   *   - peak:        hit/attack の最大不透明度（0〜1, 既定 0.6）
   *   - autoRemove:  true なら終了後に remove（既定 true / keep=true の時は false 推奨）
   */
  play(type='hit', opt={}){
    const frames = (opt.frames|0) || 12;
    const peak   = (opt.peak!=null) ? +opt.peak : 0.6;
    const keep   = !!opt.keep;
    const autoRemove = (opt.autoRemove!==false); // 既定で消す
    if (opt.color) this.setColor(opt.color);

    // 既存のアニメはキャンセル
    this.tl.clear();

    switch(type){
      case 'hit':      // 被ダメ: 赤フラッシュ
        this.setColor(opt.color || 'rgba(255,0,0,1)');
        this.opacity = 0;
        this.tl.fadeTo(peak, Math.max(1, frames/3))
               .fadeTo(0,    Math.max(1, frames/3));
        break;

      case 'attack':   // 与ダメ: 白フラッシュ
        this.setColor(opt.color || 'rgba(255,255,255,1)');
        this.opacity = 0;
        this.tl.fadeTo(peak, Math.max(1, frames/3))
               .fadeTo(0,    Math.max(1, frames/3));
        break;

      case 'darken':   // 暗転（そのまま維持 or 自動解除）
        this.setColor(opt.color || 'rgba(0,0,0,1)');
        this.opacity = 0;
        this.tl.fadeTo( (opt.to!=null? +opt.to : 1), frames );
        if (!keep && autoRemove){
          this.tl.delay(1).fadeTo(0, frames).then(()=> this.remove());
        }
        break;

      case 'lighten':  // 画面が白く（フェード）
        this.setColor(opt.color || 'rgba(255,255,255,1)');
        this.opacity = 0;
        this.tl.fadeTo( (opt.to!=null? +opt.to : 1), frames );
        if (!keep && autoRemove){
          this.tl.delay(1).fadeTo(0, frames).then(()=> this.remove());
        }
        break;

      case 'blink': {  // 点滅（任意回数）
        const times = Math.max(1, opt.times|0 || 2);
        this.opacity = 0;
        for (let i=0;i<times;i++){
          this.tl.fadeTo(peak, Math.max(1, frames/3))
                 .fadeTo(0,    Math.max(1, frames/3));
        }
        break;
      }

      case 'fadein':   // 黒や白の「幕入り」
        this.opacity = 0;
        this.tl.fadeTo( (opt.to!=null? +opt.to : 1), frames );
        break;

      case 'fadeout':  // 「幕明け」
        this.opacity = 1;
        this.tl.fadeTo(0, frames);
        break;

      default:
        // 何も指定が無ければ軽い黒フラッシュ
        this.setColor('rgba(0,0,0,1)');
        this.opacity = 0;
        this.tl.fadeTo(peak, Math.max(1, frames/3))
               .fadeTo(0,    Math.max(1, frames/3));
        break;
    }

    if (!keep && autoRemove){
      this.tl.then(()=> this.remove());
    }
    return this;
  }

  // ---- ショートカット ----
  /** シーン全体に被せて type を再生して即返す */
  static play(type='hit', opt={}){
    const ac = new AnimatedCover(undefined, undefined, { autoMount:true });
    ac.fitToScene().bringToFront().play(type, opt);
    return ac;
  }

  /** 任意ノード範囲に被せて type を再生（親は currentScene） */
  static playOnNode(node, type='hit', opt={}){
    const core = Core.instance;
    const parent = core?.currentScene;
    const ac = new AnimatedCover(1,1, { autoMount:false });
    if (parent) parent.addChild(ac);
    ac.fitToNode(node, opt.pad|0 || 0).bringToFront().play(type, opt);
    return ac;
  }
}


// =============================
// Particle — 1つのパーティクル（Spriteシート or CSS図形）
// =============================
export class Particle extends Group {
  /**
   * @param {object} opt
   *  位置/物理: { x,y, vx,vy, ax,ay, gravity }
   *  寿命: { life: 30 } // フレーム数
   *  表示共通: { scaleFrom:1, scaleTo:1, opacityFrom:1, opacityTo:0, rotationFrom:0, rotationTo:0 }
   *  種別:
   *    type:'sprite' のとき:
   *      { type:'sprite', image, fw, fh, frames, fps }
   *        - image: URL or HTMLImageElement
   *        - fw, fh: 1フレームの幅/高さ
   *        - frames: 再生フレーム数（配列も可: [[ix,iy], ...]）
   *        - fps: アニメ速度（省略時 life に均等割り）
   *    type:'css' のとき:
   *      { type:'css', shape:'circle'|'rect'|'pill'|'diamond', size:12, color:'#fff', border, shadow, className }
   */
  constructor(opt = {}) {
    super();
    // ---- 物理/寿命 ----
    this.life = (opt.life|0) || 30;
    this.age = 0;

    this.vx = +opt.vx || 0;
    this.vy = +opt.vy || 0;
    this.ax = +opt.ax || 0;
    this.ay = +opt.ay || 0;
    this.gravity = +opt.gravity || 0;

    // ---- 変化 ----
    this.scaleFrom   = (opt.scaleFrom!=null)? +opt.scaleFrom : 1;
    this.scaleTo     = (opt.scaleTo  !=null)? +opt.scaleTo   : 1;
    this.opacityFrom = (opt.opacityFrom!=null)? +opt.opacityFrom : 1;
    this.opacityTo   = (opt.opacityTo  !=null)? +opt.opacityTo   : 0;
    this.rotationFrom= (opt.rotationFrom!=null)? +opt.rotationFrom: 0;
    this.rotationTo  = (opt.rotationTo  !=null)? +opt.rotationTo  : 0;

    // ---- 位置 ----
    if (opt.x!=null) this.x = +opt.x;
    if (opt.y!=null) this.y = +opt.y;

    // ---- 見た目（sprite or css）----
    this.kind = opt.type || 'css';
    if (this.kind === 'sprite') {
      // スプライトシート方式
      const fw = opt.fw|0 || 16, fh = opt.fh|0 || 16;
      const img = opt.image;
      this.view = new Sprite(fw, fh);
      this.view.image = img;
      // frames 指定（数 or 配列）
      if (Array.isArray(opt.frames)) {
        this.view.frames = opt.frames;
        this._totalFrames = opt.frames.length;
      } else {
        this._totalFrames = (opt.frames|0) || Math.max(1, Math.floor((this.view._sheetWidth/fw)*(this.view._sheetHeight/fh)));
      }
      this._animFps = opt.fps || null; // null の場合は life で均等割り
      this.addChild(this.view);
    } else {
      // CSS 図形方式
      const size = opt.size|0 || 12;
      this.view = new Entity(size, size);
      const st = this.view._element.style;
      st.background = opt.color || '#fff';
      st.border     = opt.border || '';
      st.boxShadow  = opt.shadow || '';
      if (opt.className) this.view._element.classList.add(opt.className);

      const shape = (opt.shape||'circle');
      switch(shape){
        case 'pill':    st.borderRadius='999px'; st.width=size*2+'px'; this.view.width=size*2; break;
        case 'diamond': st.transform = 'rotate(45deg)'; break;
        case 'rect':    st.borderRadius='2px'; break;
        default:        st.borderRadius='50%'; // circle
      }
      this.addChild(this.view);
    }

    // 初期状態を適用
    this.scaleX = this.scaleY = this.scaleFrom;
    this.opacity = this.opacityFrom;
    this.rotation = this.rotationFrom;

    // フレーム更新
    this.on(Event.ENTER_FRAME, this._step.bind(this));
  }

  _step(){
    const t = this.age / Math.max(1, this.life); // 0..1
    // 物理
    this.vx += this.ax;
    this.vy += (this.ay + this.gravity);
    this.x  += this.vx;
    this.y  += this.vy;

    // 変化（線形）
    this.scaleX = this.scaleY = this._lerp(this.scaleFrom, this.scaleTo, t);
    this.opacity = this._lerp(this.opacityFrom, this.opacityTo, t);
    this.rotation = this._lerp(this.rotationFrom, this.rotationTo, t);

    // スプライトアニメ
    if (this.kind === 'sprite' && this._totalFrames){
      const fps = this._animFps || (this.life / this._totalFrames);
      const frameIndex = Math.min(this._totalFrames - 1, Math.floor(this.age / Math.max(1, fps)));
      this.view.frame = frameIndex;
    }

    this.age++;
    if (this.age >= this.life){
      this.remove();
    }
  }

  _lerp(a,b,t){ return a + (b-a) * Math.max(0, Math.min(1, t)); }

  // ========= static ヘルパ =========

  /**
   * クリック演出などに便利なバースト発生
   * @param {Node} parent  追加先（Sceneや任意Group）
   * @param {number} x     中心x
   * @param {number} y     中心y
   * @param {object} opt
   *   { count, speedMin, speedMax, spread, gravity, css, sprite }
   *   - spread: 放射角（度）。省略で360°
   *   - css:   CSS 図形の共通オプション（color/size/shape等）
   *   - sprite: スプライト方式の共通オプション（image, fw, fh, frames, fps）
   *   - type: 'css'|'sprite'（省略時 'css'）
   */
  static burst(parent, x, y, opt={}){
    const count = opt.count|0 || 16;
    const speedMin = (opt.speedMin!=null)? +opt.speedMin : 2;
    const speedMax = (opt.speedMax!=null)? +opt.speedMax : 5;
    const spread = (opt.spread!=null)? +opt.spread : 360;
    const g = (opt.gravity!=null)? +opt.gravity : 0.2;
    const type = opt.type || 'css';

    const baseAngle = Math.random()*360;
    for (let i=0;i<count;i++){
      const ang = (spread>=360)? (i*(360/count)) : (baseAngle + (Math.random()*spread - spread/2));
      const spd = speedMin + Math.random()*(speedMax-speedMin);
      const rad = ang * Math.PI/180;
      const p = new Particle(Object.assign(
        {
          type,
          x, y,
          vx: Math.cos(rad)*spd,
          vy: Math.sin(rad)*spd,
          gravity: g,
          life: 30 + (Math.random()*10|0),
          scaleFrom: 1,
          scaleTo: 0.6,
          opacityFrom: 1,
          opacityTo: 0
        },
        (type==='sprite' ? (opt.sprite||{}) : (opt.css||{}))
      ));
      parent.addChild(p);
    }
  }
}

// =============================
// LoadingScene — ensureAssets で追加読込＋バー表示＋次シーン遷移
// =============================
export class LoadingScene extends Scene {
  /**
   * @param {object} opts
   *   - files: string[] | string    読み込みたい追加アセット
   *   - next : function | string | Scene
   *           関数: (core)=>Scene を返す / 文字列: グローバル関数名 / 直接 Scene
   *   - label: 'Loading...'         表示テキスト
   *   - barWidth, barHeight, barColor, barBgColor, barRadius
   */
  constructor(opts = {}) {
    super();
    this._files = [];
    if (Array.isArray(opts.files)) this._files = opts.files.slice();
    else if (typeof opts.files === 'string') this._files = [opts.files];

    this._next = opts.next;
    this._labelText = (opts.label != null) ? String(opts.label) : 'Loading...';

    this.backgroundColor = 'rgba(0,0,0,0.75)';

    // ラベル
    this._label = new Label(this._labelText);
    this._label.color = '#fff';
    this._label.font  = 'bold 18px system-ui, sans-serif';
    this.addChild(this._label);

    // バー（枠＋中身）
    const bw = (opts.barWidth|0)  || 260;
    const bh = (opts.barHeight|0) || 14;
    const radius = (opts.barRadius!=null ? opts.barRadius|0 : 7);

    this._barBg = new Entity(bw, bh);
    this._barBg.backgroundColor = opts.barBgColor || 'rgba(255,255,255,.15)';
    this._barBg._element.style.borderRadius = radius + 'px';
    this.addChild(this._barBg);

    this._bar = new Entity(1, Math.max(2, bh-2));
    this._bar.backgroundColor = opts.barColor || '#4FC3F7';
    this._bar._element.style.left = '1px';
    this._bar._element.style.top  = Math.round((bh - (bh-2))/2) + 'px';
    this._bar._element.style.borderRadius = Math.max(0, radius-1) + 'px';
    this.addChild(this._bar);

    // パーセント表示（任意）
    this._percent = new Label('0%');
    this._percent.color = '#fff';
    this._percent.font  = '12px system-ui, sans-serif';
    this._percent.textAlign = 'center';
    this.addChild(this._percent);

    // レイアウト
    this.on(Event.ENTER, ()=> this._layout());
    this.on(Event.CORE_RESIZE, ()=> this._layout());

    // 進捗（ensureAssets は Event.PROGRESS を emit する）
    this.on(Event.PROGRESS, (e)=>{
      // phase が 'runtime' のときだけ拾う（preload と区別）
      if (e.phase && e.phase !== 'runtime') return;
      const p = (e.total>0 ? (e.loaded/e.total) : 0);
      this._setProgress(p);
    });

    // 読込開始
    this.on(Event.ENTER, ()=> this._begin());
  }

  _layout(){
    const core = Core.instance;
    const W = core ? core.width  : (this.width||320);
    const H = core ? core.height : (this.height||240);

    // ラベル
    this._label.width = W; this._label.height = 24;
    this._label.x = 0; this._label.y = Math.round(H*0.5) - 40;
    this._label.textAlign = 'center';

    // バー中央
    const bw = this._barBg.width, bh = this._barBg.height;
    this._barBg.x = Math.round((W - bw)/2);
    this._barBg.y = Math.round((H - bh)/2);
    this._bar.x = this._barBg.x + 1;
    this._bar.y = this._barBg.y + 1;

    // パーセント
    this._percent.width = W; this._percent.height = 14;
    this._percent.x = 0; this._percent.y = this._barBg.y + bh + 10;
    this._percent.textAlign = 'center';
  }

  _setProgress(p){
    p = Math.max(0, Math.min(1, p));
    const usable = this._barBg.width - 2;
    this._bar.width = Math.max(1, Math.round(usable * p));
    this._percent.text = Math.round(p*100) + '%';
  }

  async _begin(){
    const core = Core.instance;
    if (!core) return this._goNext();

    if (!this._files || this._files.length === 0){
      this._setProgress(1);
      return this._goNext();
    }

    try{
      // ensureAssets: まだ読み込まれていないものだけロード
      await core.ensureAssets(this._files, { emitProgress: true });
      this._setProgress(1);
    }catch(err){
      console.error('LoadingScene ensureAssets error:', err);
      // エラーでも一旦先へ
      this._setProgress(1);
    }
    this._goNext();
  }

  _goNext(){
    const core = Core.instance;
    if (!core){ return; }

    let nextScene = null;
    if (typeof this._next === 'function'){
      nextScene = this._next(core);
    } else if (typeof this._next === 'string' && typeof window !== 'undefined' && typeof window[this._next] === 'function'){
      nextScene = window[this._next](core);
    } else if (this._next && typeof this._next === 'object'){
      nextScene = this._next;
    }

    if (nextScene instanceof Scene){
      core.replaceScene(nextScene);
    } else {
      // 不正 or 未指定なら戻す
      core.popScene();
    }
  }
}


const MENU_SCENE_BUTTON_THEMES = {
  blue: {
    normal:  { bg:'#2b87ff', border:'#0f5bd5', color:'#fff' },
    hover:   { bg:'#4897ff', border:'#0f5bd5', color:'#fff' },
    active:  { bg:'#166ff0', border:'#0b4cc0', color:'#eaf3ff' },
    disabled:{ bg:'#9db9e8', border:'#8aa3cc', color:'#f6f9ff' }
  },
  green: {
    normal:  { bg:'#2e8b57', border:'#1f613c', color:'#f4fff5' },
    hover:   { bg:'#379d62', border:'#1f613c', color:'#f6fff8' },
    active:  { bg:'#227547', border:'#184d2f', color:'#e2f7e5' },
    disabled:{ bg:'#a2cbb2', border:'#7fa38b', color:'#f0faf2' }
  },
  orange: {
    normal:  { bg:'#ff8a3d', border:'#d76612', color:'#fff' },
    hover:   { bg:'#ff9b59', border:'#d76612', color:'#fffaf5' },
    active:  { bg:'#e57124', border:'#b9540c', color:'#fff2e7' },
    disabled:{ bg:'#f4c6a0', border:'#d09c6f', color:'#fff8f1' }
  },
  gray: {
    normal:  { bg:'#5f6b7d', border:'#3c4553', color:'#f3f4f9' },
    hover:   { bg:'#6b788b', border:'#3c4553', color:'#ffffff' },
    active:  { bg:'#4e586a', border:'#2f3641', color:'#e8eaf0' },
    disabled:{ bg:'#9fa5b1', border:'#8a909a', color:'#f5f6f9' }
  },
  beige: {
    normal:  { bg:'#f2e6d3', border:'#d5c1a1', color:'#5a4632' },
    hover:   { bg:'#f7ecd9', border:'#d5c1a1', color:'#5a4632' },
    active:  { bg:'#e7d7c0', border:'#c2ae91', color:'#4a3826' },
    disabled:{ bg:'#f7efe4', border:'#dfd2c1', color:'#8b7a68' }
  },
  rust: {
    normal:  { bg:'#d16a3a', border:'#9d471d', color:'#fff3ec' },
    hover:   { bg:'#df7b4d', border:'#9d471d', color:'#fff7f1' },
    active:  { bg:'#b95a28', border:'#853713', color:'#ffe8dc' },
    disabled:{ bg:'#e4aa8a', border:'#c27856', color:'#fff4ec' }
  }
};

function cloneButtonTheme(theme){
  if (!theme) return null;
  return {
    normal:   { ...(theme.normal   || {}) },
    hover:    { ...(theme.hover    || {}) },
    active:   { ...(theme.active   || {}) },
    disabled: { ...(theme.disabled || {}) }
  };
}

function deepClone(obj){
  if (obj == null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const key in obj){
    if (Object.prototype.hasOwnProperty.call(obj, key)){
      out[key] = deepClone(obj[key]);
    }
  }
  return out;
}

function applyOverrides(target, override){
  if (!override || typeof override !== 'object') return target;
  Object.keys(override).forEach(key => {
    const value = override[key];
    if (value && typeof value === 'object' && !Array.isArray(value)){
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])){
        target[key] = deepClone(value);
      } else {
        applyOverrides(target[key], value);
      }
    } else {
      target[key] = value;
    }
  });
  return target;
}

function mergePalette(base, override){
  const cloned = deepClone(base);
  return applyOverrides(cloned, override);
}

const MENU_SCENE_PRESETS = {
  default: {
    backgroundColor: 'rgba(240,244,255,0.9)',
    frameTheme: 'panel',
    framePadding: { top:28, right:32, bottom:28, left:32 },
    titleColor: '#1f2a44',
    descriptionColor: '#1f2a44',
    noteColor: 'rgba(31,42,68,0.72)',
    errorColor: '#b00020',
    counterValueColor: '#1f2a44',
    emptyMessageColor: '#b00020',
    overlay: { preset: 'arcade', options: {} },
    statusbarDefaults: {
      gauge: { bgColor:'#24426f', barColor:'#4fc3f7', valueColor:'#fff', showValue:true },
      tokens: { symbolFilled:'●', symbolEmpty:'○', tokenSize:20, spacing:6 }
    },
    buttonThemes: {
      primary: MENU_SCENE_BUTTON_THEMES.blue,
      secondary: MENU_SCENE_BUTTON_THEMES.gray,
      accent: MENU_SCENE_BUTTON_THEMES.blue
    }
  },
  warm: {
    backgroundColor: 'rgba(255,245,235,0.92)',
    frameTheme: 'accent',
    framePadding: { top:32, right:32, bottom:32, left:32 },
    titleColor: '#6b3b12',
    descriptionColor: '#7b4315',
    noteColor: 'rgba(123,67,21,0.72)',
    errorColor: '#b3261e',
    counterValueColor: '#6b3b12',
    emptyMessageColor: '#b3261e',
    overlay: { preset: 'rounded', options: { boxShadow: '0 10px 28px rgba(168,98,34,.35)' } },
    statusbarDefaults: {
      gauge: { bgColor:'#c7762a', barColor:'#ffb74d', valueColor:'#fff', showValue:true },
      tokens: { symbolFilled:'★', symbolEmpty:'☆', tokenSize:22, spacing:6 }
    },
    buttonThemes: {
      primary: MENU_SCENE_BUTTON_THEMES.orange,
      secondary: MENU_SCENE_BUTTON_THEMES.beige,
      accent: MENU_SCENE_BUTTON_THEMES.rust
    }
  },
  forest: {
    backgroundColor: 'rgba(232,245,236,0.9)',
    frameTheme: 'dark',
    framePadding: { top:28, right:32, bottom:32, left:32 },
    titleColor: '#1f3b2d',
    descriptionColor: '#1f3b2d',
    noteColor: 'rgba(31,59,45,0.75)',
    errorColor: '#ba1a1a',
    counterValueColor: '#1f3b2d',
    emptyMessageColor: '#ba1a1a',
    overlay: { preset: 'shadow-only', options: { boxShadow: '0 12px 24px rgba(0,0,0,.45)' } },
    statusbarDefaults: {
      gauge: { bgColor:'#22543d', barColor:'#4caf50', valueColor:'#e8f5e9', showValue:true },
      tokens: { symbolFilled:'■', symbolEmpty:'□', tokenSize:20, spacing:5 }
    },
    buttonThemes: {
      primary: MENU_SCENE_BUTTON_THEMES.green,
      secondary: MENU_SCENE_BUTTON_THEMES.gray,
      accent: MENU_SCENE_BUTTON_THEMES.green
    }
  }
};

export class MenuScene extends Scene {
  constructor(opts={}){
    super();
    const options = (opts && typeof opts === 'object') ? opts : {};
    if (!options.key) throw new Error('MenuScene: options.key is required');
    if (typeof options.onComplete !== 'function') throw new Error('MenuScene: options.onComplete callback is required');

    this._key = String(options.key);
    this._onComplete = options.onComplete;
    this._onCancel = (typeof options.onCancel === 'function') ? options.onCancel : null;
    this._title = options.title != null ? String(options.title) : '';
    this._description = options.description != null ? String(options.description) : '';

    const paletteName = options.uiPreset || options.palette || 'default';
    const basePalette = MENU_SCENE_PRESETS[paletteName] || MENU_SCENE_PRESETS.default;
    const paletteOverrides = options.colors || options.paletteOverrides || null;
    this._paletteName = paletteName;
    this._palette = mergePalette(basePalette, paletteOverrides);

    this._theme = options.theme || this._palette.frameTheme || 'panel';
    this._framePadding = this._normalizePadding(options.framePadding != null ? options.framePadding : this._palette.framePadding);
    this._selectorType = (options.selectorType || 'list').toLowerCase();
    if (!['list','grid','counter'].includes(this._selectorType)) this._selectorType = 'list';
    this._options = Array.isArray(options.options) ? options.options.map(o => (o && typeof o === 'object') ? { ...o } : { value: o, label: String(o) }) : [];
    this._range = (options.range && typeof options.range === 'object') ? { ...options.range } : {};
    this._deps = options.deps || null;
    this._statusbarOpt = options.statusbar ? deepClone(options.statusbar) : null;
    this._assets = Array.isArray(options.assets) ? options.assets.filter(v => typeof v === 'string' && v) : [];
    this._debounceMs = (options.debounceMs != null) ? Math.max(0, options.debounceMs|0) : 300;

    const baseOverlayOptions = this._palette.overlay && this._palette.overlay.options ? deepClone(this._palette.overlay.options) : {};
    const overlayOverrides = options.overlayOptions || null;
    this._overlayPreset = options.overlayPreset || (this._palette.overlay && this._palette.overlay.preset ? this._palette.overlay.preset : 'simple');
    this._overlayOptions = applyOverrides(baseOverlayOptions, overlayOverrides || {});
    this._forceOverlayPreset = options.overlayPreset != null || (overlayOverrides && Object.keys(overlayOverrides).length > 0);
    this._frameOverlay = this._resolveFrameOverlay(options.frameOverlay, options.reuseOverlay !== false);


    this._buttons = [];
    this._locked = false;
    this._lockTimer = null;
    this._body = null;
    this._footer = null;
    this._bodyCursor = 0;
    this._valueLabel = null;
    this._minusEntry = null;
    this._plusEntry = null;
    this._confirmEntry = null;
    this._errorLabel = null;
    this._currentValue = 0;
    this._minValue = 0;
    this._maxValue = 0;
    this._stepValue = 1;
    this._unitLabel = '';
    this._noOptions = false;
    this._loadingLabel = null;

    this.backgroundColor = options.backgroundColor || this._palette.backgroundColor || 'rgba(240,244,255,0.85)';

    this._showLoadingIndicator();

    this._ensureAssets()
      .catch(err => {
        console.error('MenuScene ensureAssets error:', err);
      })
      .then(() => {
        this._buildUI();
      });
  }

  _showLoadingIndicator(){
    if (this._loadingLabel) return;
    const label = new Label('読み込み中...');
    label.font = 'bold 20px system-ui, sans-serif';
    label.color = (this._palette && this._palette.titleColor) ? this._palette.titleColor : '#2b3a56';
    label.textAlign = 'center';
    const core = Core.instance;
    const w = core ? core.width : (this.width || 360);
    const h = core ? core.height : (this.height || 240);
    label.width = w;
    label.moveTo(0, Math.round(h/2 - 20));
    this._loadingLabel = label;
    this.addChild(label);
  }

  _removeLoadingIndicator(){
    if (!this._loadingLabel) return;
    this.removeChild(this._loadingLabel);
    this._loadingLabel = null;
  }

  async _ensureAssets(){
    if (!this._assets.length) return;
    const core = Core.instance;
    if (!core || typeof core.ensureAssets !== 'function') return;
    await core.ensureAssets(this._assets);
  }

  _normalizePadding(padding){
    const fallback = this._palette && this._palette.framePadding ? this._palette.framePadding : { top:28, right:28, bottom:28, left:28 };
    if (padding == null) return { ...fallback };
    if (typeof padding === 'number'){
      return { top:padding, right:padding, bottom:padding, left:padding };
    }
    return {
      top:   padding.top   != null ? padding.top   : fallback.top,
      right: padding.right != null ? padding.right : fallback.right,
      bottom:padding.bottom!= null ? padding.bottom: fallback.bottom,
      left:  padding.left  != null ? padding.left  : fallback.left
    };
  }

  _resolveFrameOverlay(explicit, allowReuse){
    this._overlayInherited = false;
    if (explicit === null) return null;
    if (explicit instanceof FrameOverlay){
      this._overlayInherited = true;
      return explicit;
    }
    if (!allowReuse) return null;
    const core = Core.instance;
    if (!core || !core.currentScene || core.currentScene === this) return null;
    const prev = core.currentScene;
    for (let i = prev.childNodes.length - 1; i >= 0; i--){
      const node = prev.childNodes[i];
      if (node instanceof FrameOverlay){
        prev.removeChild(node);
        this._overlayInherited = true;
        return node;
      }
    }
    return null;
  }

  _createFrameOverlay(){
    const preset = this._overlayPreset || 'simple';
    const opts = this._overlayOptions || {};
    const overlay = new FrameOverlay(preset, opts);
    if (typeof overlay.fitToCore === 'function') overlay.fitToCore();
    return overlay;
  }

  _attachFrameOverlay(){
    if (!this._frameOverlay){
      this._overlayInherited = false;
      this._frameOverlay = this._createFrameOverlay();
    }
    if (!this._frameOverlay) return;
    if (this._frameOverlay.parentNode !== this){
      this.addChild(this._frameOverlay);
    }
    if (typeof this._frameOverlay.fitToCore === 'function'){
      this._frameOverlay.fitToCore();
    }
    if (!this._overlayInherited || this._forceOverlayPreset){
      this._frameOverlay.usePreset(this._overlayPreset || 'simple', this._overlayOptions || {});
    }
  }

  _applyButtonTheme(button, role='primary'){
    if (!button || typeof button.setThemes !== 'function' || !this._palette || !this._palette.buttonThemes) return;
    const paletteTheme = this._palette.buttonThemes[role] || this._palette.buttonThemes.primary;
    if (!paletteTheme) return;
    const theme = cloneButtonTheme(paletteTheme);
    if (theme) button.setThemes(theme);
  }

  _buildUI(){
    this._removeLoadingIndicator();
    this._buttons = [];
    this._locked = false;
    if (this._lockTimer){ clearTimeout(this._lockTimer); this._lockTimer = null; }

    const core = Core.instance;
    const stageW = core ? core.width : (this.width || 768);
    const stageH = core ? core.height : (this.height || 576);
    this.width = stageW;
    this.height = stageH;

    const margin = 48;
    const estimatedHeight = this._selectorType === 'counter' ? 320 : Math.max(320, 240 + this._options.length * (this._selectorType === 'grid' ? 80 : 60));
    const winW = Math.max(320, stageW - margin * 2);
    const winH = Math.min(stageH - margin * 2, Math.max(280, estimatedHeight));
    this._window = new FrameWindow(winW, winH, this._theme);
    if (this._framePadding) this._window.padding = this._framePadding;
    this._window.moveTo(Math.round((stageW - this._window._w) / 2), Math.round((stageH - this._window._h) / 2));
    this.addChild(this._window);

    const content = this._window.content;
    const contentWidth = this._window.contentWidth;
    const contentHeight = this._window.contentHeight;

    const needFooter = (this._selectorType === 'counter') || !!this._onCancel;
    const footerHeight = needFooter ? 72 : 0;
    const bodyHeight = Math.max(0, contentHeight - footerHeight);

    this._body = new Entity(contentWidth, bodyHeight);
    this._body._element.style.overflowY = 'auto';
    this._body._element.style.overflowX = 'hidden';
    this._body._element.style.boxSizing = 'border-box';
    this._body._element.style.paddingRight = '16px';
    this._body._element.style.paddingBottom = '8px';
    this._body.moveTo(0, 0);
    content.addChild(this._body);

    this._footer = null;
    if (needFooter){
      this._footer = new Group();
      this._footer.width = contentWidth;
      this._footer.height = footerHeight;
      this._footer.x = 0;
      this._footer.y = bodyHeight + 8;
      content.addChild(this._footer);
    }

    this._bodyCursor = 0;
    this._composeHeader();
    this._composeSelection();
    this._composeFooter();
    this._setButtonsEnabled(true);
    this._applyCounterLimits();
    this._attachFrameOverlay();
  }

  _composeHeader(){
    const width = this._body.width || this._window.contentWidth;
    let y = this._bodyCursor || 0;
    if (this._title){
      const title = new Label(this._title);
      title.font = 'bold 26px system-ui, sans-serif';
      title.color = (this._palette && this._palette.titleColor) || '#1f2a44';
      title.textAlign = 'left';
      title.width = width;
      title.moveTo(0, y);
      this._body.addChild(title);
      y += 36;
    }
    if (this._statusbarOpt){
      const typeKey = (this._statusbarOpt.type === 'token') ? 'tokens' : (this._statusbarOpt.type || 'gauge');
      const statusDefaults = (this._palette && this._palette.statusbarDefaults) ? this._palette.statusbarDefaults : {};
      const baseDefaults = deepClone(statusDefaults[typeKey] || {});
      const sbUser = deepClone(this._statusbarOpt);
      const progressValue = sbUser.progress;
      const tokenCount = sbUser.tokens;
      delete sbUser.type;
      delete sbUser.progress;
      delete sbUser.tokens;
      const sbOptions = Object.assign({
        width: width,
        label: sbUser.label || '',
        labelAlign: sbUser.labelAlign || 'top'
      }, baseDefaults, sbUser);
      const statusBar = new StatusBar(typeKey, sbOptions);
      statusBar.moveTo(0, y);
      this._body.addChild(statusBar);
      y += statusBar.height + 12;
      if (typeKey === 'tokens'){
        const tokenMax = tokenCount != null ? Math.max(1, +tokenCount) : (sbOptions.max != null ? +sbOptions.max : statusBar.max);
        statusBar.setMax(tokenMax);
      }
      if (progressValue != null){
        const progress = Math.max(0, Math.min(1, +progressValue));
        if (typeKey === 'gauge'){
          const maxValue = sbOptions.max != null ? +sbOptions.max : statusBar.max;
          statusBar.setMax(maxValue);
          statusBar.setValue(progress * statusBar.max, false);
        } else {
          const tokenMax = statusBar.max || 1;
          statusBar.setValue(Math.round(progress * tokenMax), false);
        }
      }
    }
    if (this._description){
      const lines = this._description.split(/\r?\n/);
      const descHeight = Math.min(140, Math.max(60, lines.length * 28));
      const desc = new LabelArea(width, descHeight, {
        text: this._description,
        font: '18px system-ui, sans-serif',
        lineHeight: 1.4,
        color: (this._palette && this._palette.descriptionColor) || '#1f2a44'
      });
      desc.skipAll();
      desc.moveTo(0, y);
      this._body.addChild(desc);
      y += descHeight + 16;
    }
    this._bodyCursor = y;
  }

  _composeSelection(){
    let y = this._bodyCursor || 0;
    if (this._selectorType === 'counter'){
      y = this._composeCounter(y);
    } else {
      if (!this._options.length){
        this._noOptions = true;
        const message = new Label('選択肢がありません');
        message.font = 'bold 18px system-ui, sans-serif';
        message.color = (this._palette && this._palette.emptyMessageColor) || (this._palette && this._palette.errorColor) || '#b00020';
        message.textAlign = 'center';
        message.width = this._body.width || this._window.contentWidth;
        message.moveTo(0, y + 16);
        this._body.addChild(message);
        y += 80;
      } else if (this._selectorType === 'grid'){
        y = this._composeGridOptions(y);
      } else {
        y = this._composeListOptions(y);
      }
    }
    this._bodyCursor = y;
  }

  _composeListOptions(startY){
    const width = this._body.width || this._window.contentWidth;
    const gap = 12;
    let y = startY;
    for (const opt of this._options){
      const hasNote = !!opt && !!opt.note;
      const labelText = (opt && opt.label != null) ? String(opt.label) : (opt && opt.value != null ? String(opt.value) : '選択');
      const buttonHeight = hasNote ? 88 : 64;
      const btn = new UIButton(width, buttonHeight, {
        text: labelText,
        maxFontSize: 20,
        minFontSize: 14,
        paddingX: 18,
        paddingY: 12
      });
      btn.moveTo(0, y);
      this._body.addChild(btn);
      this._applyButtonTheme(btn, 'primary');
      this._decorateOptionButton(btn, opt, 'list');
      const entry = this._registerButton(btn, { permaDisabled: !!(opt && opt.disabled) });
      if (!(opt && opt.disabled)){
        btn.on(Event.TOUCH_END, () => this._handleOptionSelect(opt));
      }
      if (opt && opt.disabled) btn.setEnabled(false);
      y += buttonHeight + gap;
    }
    return y;
  }

  _composeGridOptions(startY){
    const width = this._body.width || this._window.contentWidth;
    const gapX = 12;
    const gapY = 12;
    const columns = (width >= 540 && this._options.length >= 5) ? 3 : 2;
    const btnWidth = Math.max(140, Math.floor((width - gapX * (columns - 1)) / columns));
    const btnHeight = 130;
    let y = startY;
    this._options.forEach((opt, index) => {
      const labelText = (opt && opt.label != null) ? String(opt.label) : (opt && opt.value != null ? String(opt.value) : '選択');
      const btn = new UIButton(btnWidth, btnHeight, {
        text: labelText,
        maxFontSize: 20,
        minFontSize: 12,
        paddingX: 12,
        paddingY: 12
      });
      const col = index % columns;
      const row = Math.floor(index / columns);
      btn.moveTo(col * (btnWidth + gapX), y + row * (btnHeight + gapY));
      this._body.addChild(btn);
      this._applyButtonTheme(btn, 'primary');
      this._decorateOptionButton(btn, opt, 'grid');
      this._registerButton(btn, { permaDisabled: !!(opt && opt.disabled) });
      if (!(opt && opt.disabled)){
        btn.on(Event.TOUCH_END, () => this._handleOptionSelect(opt));
      } else {
        btn.setEnabled(false);
      }
    });
    const rows = Math.ceil(this._options.length / columns);
    return y + (rows ? (rows * (btnHeight + gapY) - gapY + 4) : 0);
  }

  _composeCounter(startY){
    this._setupRangeDefaults();
    const width = this._body.width || this._window.contentWidth;
    let y = startY;
    const buttonSize = Math.max(72, Math.min(110, Math.round(width * 0.22)));

    const minus = new UIButton(buttonSize, buttonSize, { text: '-', maxFontSize: 36, minFontSize: 24, paddingX: 12, paddingY: 12 });
    minus.moveTo(0, y);
    this._body.addChild(minus);
    this._applyButtonTheme(minus, 'accent');
    this._minusEntry = this._registerButton(minus, { type: 'minus' });
    minus.on(Event.TOUCH_END, () => this._changeCounter(-this._stepValue));

    const plus = new UIButton(buttonSize, buttonSize, { text: '+', maxFontSize: 36, minFontSize: 24, paddingX: 12, paddingY: 12 });
    plus.moveTo(width - buttonSize, y);
    this._body.addChild(plus);
    this._applyButtonTheme(plus, 'accent');
    this._plusEntry = this._registerButton(plus, { type: 'plus' });
    plus.on(Event.TOUCH_END, () => this._changeCounter(this._stepValue));

    const valueWidth = Math.max(140, width - buttonSize * 2 - 20);
    const valueLabel = new Label('');
    valueLabel.font = 'bold 44px system-ui, sans-serif';
    valueLabel.color = (this._palette && this._palette.counterValueColor) || (this._palette && this._palette.titleColor) || '#1f2a44';
    valueLabel.width = valueWidth;
    valueLabel.textAlign = 'center';
    valueLabel.moveTo(Math.round((width - valueWidth) / 2), y + Math.round(buttonSize / 2) - 30);
    this._body.addChild(valueLabel);
    this._valueLabel = valueLabel;

    y += buttonSize + 24;
    this._updateCounterDisplay();
    return y;
  }

  _composeFooter(){
    if (!this._footer) return;
    const width = this._window.contentWidth;
    const baseY = Math.max(0, this._footer.height - 56);

    if (this._onCancel){
      const backBtn = new UIButton(148, 56, { text: '戻る', maxFontSize: 18, minFontSize: 14, paddingX: 16, paddingY: 10 });
      backBtn.moveTo(0, baseY);
      this._footer.addChild(backBtn);
      this._applyButtonTheme(backBtn, 'secondary');
      this._registerButton(backBtn, { type: 'cancel' });
      backBtn.on(Event.TOUCH_END, () => this._handleCancel());
    }

    if (this._selectorType === 'counter'){
      const confirmBtn = new UIButton(168, 56, { text: '決定', maxFontSize: 18, minFontSize: 14, paddingX: 18, paddingY: 10 });
      confirmBtn.moveTo(width - confirmBtn._w, baseY);
      this._footer.addChild(confirmBtn);
      this._applyButtonTheme(confirmBtn, 'primary');
      this._confirmEntry = this._registerButton(confirmBtn, { type: 'confirm' });
      confirmBtn.on(Event.TOUCH_END, () => this._commitCounter());
    }
  }

  _decorateOptionButton(btn, opt, mode){
    const hasNote = opt && opt.note;
    const iconPath = opt && opt.icon;
    const noteColorList = (this._palette && this._palette.noteColor) || 'rgba(31,42,68,0.72)';
    const noteColorGrid = (this._palette && this._palette.gridNoteColor) || 'rgba(255,255,255,0.86)';
    if (opt && opt.label != null) btn.setText(String(opt.label));
    btn.label.fitToTextWidth = false;
    if (mode === 'grid'){
      btn.label.width = btn._w - 12;
      btn.label.textAlign = 'center';
      let labelY = hasNote ? btn._h - 54 : Math.round(btn._h / 2) - 18;
      if (iconPath){
        labelY = hasNote ? btn._h - 54 : 74;
        const icon = new Sprite(56, 56);
        icon.width = 56; icon.height = 56;
        try { icon.image = iconPath; } catch(_) {}
        icon.moveTo(Math.round((btn._w - 56)/2), 12);
        btn.addChild(icon);
      }
      btn.label.moveTo(6, labelY);
      if (hasNote){
        const note = new Label(String(opt.note));
        note.font = '14px system-ui, sans-serif';
        note.color = noteColorGrid;
        note.width = btn._w - 12;
        note.textAlign = 'center';
        note.moveTo(6, btn.label.y + 26);
        btn.addChild(note);
      }
    } else {
      const iconOffset = iconPath ? 64 : 0;
      const labelX = 18 + iconOffset;
      btn.label.width = btn._w - labelX - 16;
      btn.label.textAlign = 'left';
      btn.label.moveTo(labelX, hasNote ? 10 : Math.round((btn._h - 24) / 2));
      if (iconPath){
        const icon = new Sprite(48, 48);
        icon.width = 48; icon.height = 48;
        try { icon.image = iconPath; } catch(_) {}
        icon.moveTo(18, Math.round((btn._h - 48) / 2));
        btn.addChild(icon);
      }
      if (hasNote){
        const note = new Label(String(opt.note));
        note.font = '14px system-ui, sans-serif';
        note.color = noteColorList;
        note.width = btn._w - labelX - 16;
        note.textAlign = 'left';
        note.moveTo(labelX, btn.label.y + 28);
        btn.addChild(note);
      }
    }
    if (opt && opt.disabled) btn.setEnabled(false);
  }

  _setupRangeDefaults(){
    const range = this._range || {};
    let min = Number.isFinite(range.min) ? +range.min : 0;
    let max = Number.isFinite(range.max) ? +range.max : min + 10;
    if (max < min) max = min;
    let step = Number.isFinite(range.step) && range.step > 0 ? +range.step : 1;
    let value = Number.isFinite(range.default) ? +range.default : min;
    if (value < min || value > max) value = min;
    if (step <= 0) step = 1;
    if ((value - min) % step !== 0) value = min;
    this._minValue = min;
    this._maxValue = max;
    this._stepValue = step;
    this._currentValue = value;
    this._unitLabel = range.unitLabel ? String(range.unitLabel) : '';
  }

  _changeCounter(delta){
    if (this._locked) return;
    const next = Math.max(this._minValue, Math.min(this._maxValue, this._currentValue + delta));
    if (next === this._currentValue) return;
    this._currentValue = next;
    this._updateCounterDisplay();
  }

  _updateCounterDisplay(){
    if (!this._valueLabel) return;
    const text = this._unitLabel ? (this._currentValue + this._unitLabel) : String(this._currentValue);
    this._valueLabel.text = text;
    this._applyCounterLimits();
  }

  _composeFooterButtons(){
    // deprecated placeholder
  }

  _registerButton(button, info={}){
    const entry = {
      button,
      permaDisabled: !!info.permaDisabled,
      type: info.type || null
    };
    this._buttons.push(entry);
    return entry;
  }

  _setButtonsEnabled(flag){
    for (const entry of this._buttons){
      if (entry.permaDisabled) continue;
      entry.button.setEnabled(flag);
    }
    if (flag) this._applyCounterLimits();
  }

  _applyCounterLimits(){
    if (this._selectorType !== 'counter') return;
    const canDec = !this._locked && this._currentValue > this._minValue;
    const canInc = !this._locked && this._currentValue < this._maxValue;
    if (this._minusEntry && !this._minusEntry.permaDisabled){
      this._minusEntry.button.setEnabled(canDec);
    }
    if (this._plusEntry && !this._plusEntry.permaDisabled){
      this._plusEntry.button.setEnabled(canInc);
    }
    if (this._confirmEntry && !this._confirmEntry.permaDisabled){
      this._confirmEntry.button.setEnabled(!this._locked);
    }
  }

  _handleOptionSelect(opt){
    if (this._locked || (opt && opt.disabled)) return;
    const value = (opt && opt.value !== undefined) ? opt.value : (opt && opt.label !== undefined ? opt.label : null);
    const meta = {};
    if (opt && opt.label != null) meta.label = String(opt.label);
    if (opt && opt.note) meta.note = String(opt.note);
    if (opt && opt.icon) meta.icon = opt.icon;
    this._commitResult(value, meta);
  }

  _commitCounter(){
    if (this._locked) return;
    const meta = {};
    if (this._unitLabel) meta.unit = this._unitLabel;
    meta.label = this._unitLabel ? (this._currentValue + this._unitLabel) : String(this._currentValue);
    this._commitResult(this._currentValue, meta);
  }

  _commitResult(value, meta){
    const payload = { key: this._key, value };
    if (meta && Object.keys(meta).length){
      payload.meta = { ...meta };
    }
    if (this._deps){
      if (!payload.meta) payload.meta = {};
      payload.meta.deps = this._deps;
    }
    this._lockInteraction(true);
    try {
      this._onComplete(payload);
    } catch(err){
      console.error('MenuScene onComplete error:', err);
      this._showErrorMessage('エラーが発生しました。もう一度ためしてね。');
      this._unlockAfterError();
    }
  }

  _handleCancel(){
    if (!this._onCancel || this._locked) return;
    this._lockInteraction(true);
    try {
      this._onCancel();
    } catch(err){
      console.error('MenuScene onCancel error:', err);
      this._showErrorMessage('戻る処理でエラーが発生しました。');
      this._unlockAfterError();
    }
  }

  _lockInteraction(finalize=false){
    if (this._lockTimer){ clearTimeout(this._lockTimer); this._lockTimer = null; }
    this._locked = true;
    this._setButtonsEnabled(false);
    if (!finalize && this._debounceMs > 0){
      this._lockTimer = setTimeout(() => {
        this._lockTimer = null;
        this._locked = false;
        this._setButtonsEnabled(true);
      }, this._debounceMs);
    }
  }

  _unlockAfterError(){
    if (this._lockTimer){ clearTimeout(this._lockTimer); this._lockTimer = null; }
    this._locked = false;
    this._setButtonsEnabled(true);
  }

  _showErrorMessage(text){
    if (!text) return;
    if (!this._errorLabel){
      this._errorLabel = new Label(text);
      this._errorLabel.font = 'bold 16px system-ui, sans-serif';
      this._errorLabel.color = (this._palette && this._palette.errorColor) || '#b00020';
      this._errorLabel.textAlign = 'center';
      this._errorLabel.width = this._window ? this._window.contentWidth : (this._body ? this._body.width : 320);
      if (this._footer){
        this._errorLabel.moveTo(0, Math.max(0, this._footer.y - 30));
        this._window.content.addChild(this._errorLabel);
      } else if (this._body){
        this._errorLabel.moveTo(0, this._bodyCursor + 8);
        this._body.addChild(this._errorLabel);
      } else {
        this.addChild(this._errorLabel);
      }
    }
    this._errorLabel.text = text;
    if (this._footer){
      this._errorLabel.moveTo(0, Math.max(0, this._footer.y - 30));
    }
  }
}
