// managic_ui.js — UI helpers for managic_dom.js (ESM, no dependencies)
import { Group, Entity, Sprite, Label, Event } from './managic_dom.js';

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
    this.addChild(this.label);

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
    this._w=w|0; this._h=h|0;
    if (this._bgSprite){ this._bgSprite.width=this._w; this._bgSprite.height=this._h; }
    if (this._bg){ this._bg.width=this._w; this._bg.height=this._h; }
    this._relayout(); return this;
  }

  setText(text){ this.label.text = text; this._relayout(); return this; }

  setEnabled(flag){
    this._enabled = !!flag;
    this.touchEnabled = this._enabled;
    this._applyState(this._enabled ? 'normal' : 'disabled');
  }

  setFrames(map){ this._frames = map; this._applyState('normal'); }
  setThemes(map){ this._themes = map; this._applyState('normal'); }

  // 内部：ラベル中央寄せ
  _relayout(){
    const paddingX = 12, paddingY = 6;
    // Labelは自動採寸なので、中央寄せにする
    this.label.x = Math.round((this._w - this.label.width)/2);
    this.label.y = Math.round((this._h - this.label.height)/2);
    // 余白を確保（必要なら）
    this.label.x = Math.max(paddingX, this.label.x);
    this.label.y = Math.max(paddingY, this.label.y);
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
}
