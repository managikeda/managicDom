// managic-dom.js — MVP ES module compatible shim for enchant.js (DOM/CSS renderer, no canvas)
// Goals: keep API/feel of Core, Scene, Group, Sprite, Label so most existing code runs with minimal edits.
// Notes:
//  - No dependency on other libraries. Pure DOM/CSS.
//  - No Canvas usage; nodes render as <div>/<img> with CSS transforms.
//  - ES module: `import { Core, Scene, Group, Sprite, Label } from './managic-dom.js'`
//  - Known deviations (v0): No Surface/Sound/Timeline/Map (tile map) yet. `Map` intentionally omitted to avoid ES Map conflict.
//  - Compatibility shims: export `Game` alias to `Core`; export `Splite` alias to `Sprite` to survive typos.
//
// Future roadmap (v1+): Surface wrapper over OffscreenCanvas (optional), WebAudio Sound, DOM-based TileMap (renamed TileLayer),
// Sprite frame animation, Timeline tweens.

// =============================
// Event system (minimal, enchant-like)
// =============================
export class Event {
  constructor(type) {
    this.type = type;
    this.target = null;
    this.x = 0;
    this.y = 0;
    this.localX = 0;
    this.localY = 0;
    this.elapsed = 0;
  }
}
Event.LOAD = 'load';
Event.ERROR = 'error';
Event.CORE_RESIZE = 'coreresize';
Event.PROGRESS = 'progress';
Event.ENTER_FRAME = 'enterframe';
Event.EXIT_FRAME = 'exitframe';
Event.ENTER = 'enter';
Event.EXIT = 'exit';
Event.CHILD_ADDED = 'childadded';
Event.ADDED = 'added';
Event.ADDED_TO_SCENE = 'addedtoscene';
Event.CHILD_REMOVED = 'childremoved';
Event.REMOVED = 'removed';
Event.REMOVED_FROM_SCENE = 'removedfromscene';
Event.TOUCH_START = 'touchstart';
Event.TOUCH_MOVE = 'touchmove';
Event.TOUCH_END = 'touchend';
Event.RENDER = 'render';
Event.INPUT_START = 'inputstart';
Event.INPUT_CHANGE = 'inputchange';
Event.INPUT_END = 'inputend';
Event.LEFT_BUTTON_DOWN = 'leftbuttondown';
Event.LEFT_BUTTON_UP = 'leftbuttonup';
Event.RIGHT_BUTTON_DOWN = 'rightbuttondown';
Event.RIGHT_BUTTON_UP = 'rightbuttonup';
Event.UP_BUTTON_DOWN = 'upbuttondown';
Event.UP_BUTTON_UP = 'upbuttonup';
Event.DOWN_BUTTON_DOWN = 'downbuttondown';
Event.DOWN_BUTTON_UP = 'downbuttonup';
Event.A_BUTTON_DOWN = 'abuttondown';
Event.A_BUTTON_UP = 'abuttonup';
Event.B_BUTTON_DOWN = 'bbuttondown';
Event.B_BUTTON_UP = 'bbuttonup';

export class EventTarget {
  constructor() { this._listeners = Object.create(null); }
  addEventListener(type, listener) {
    if (!this._listeners[type]) this._listeners[type] = [];
    const list = this._listeners[type];
    if (list.indexOf(listener) === -1) list.unshift(listener);
  }
  on(type, listener) { this.addEventListener(type, listener); }
  removeEventListener(type, listener) {
    const list = this._listeners[type];
    if (!list) return;
    const i = list.indexOf(listener);
    if (i !== -1) list.splice(i,1);
  }
  clearEventListener(type) {
    if (type) delete this._listeners[type];
    else this._listeners = Object.create(null);
  }
  dispatchEvent(e) {
    e.target = this;
    if (this['on' + e.type]) this['on' + e.type](e);
    const list = this._listeners[e.type];
    if (!list) return;
    // copy to prevent mutation during iteration
    [...list].forEach(fn => fn.call(this, e));
  }
}

// =============================
// Node / Entity base (DOM-backed)
// =============================
class DomUtil {
  static create(tag='div', className='') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.style.position = 'absolute';
    el.style.willChange = 'transform, opacity';
    el.style.transformOrigin = '50% 50%';
    return el;
  }
  static setTransform(el, {x=0,y=0,rotation=0,scaleX=1,scaleY=1}){
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
  }
}

export class Node extends EventTarget {
  constructor() {
    super();
    this.age = 0;
    this.parentNode = null;
    this.scene = null;
    this.childNodes = [];

    this._x = 0; this._y = 0;
    this._width = 0; this._height = 0;
    this._rotation = 0;
    this._scaleX = 1; this._scaleY = 1;
    this._opacity = 1;
    this.visible = true;
    this._touchEnabled = true;

    this._dirty = true; // needs transform update

    this._element = DomUtil.create('div','enchant-node');
    this._element.__node__ = this;
    this._element.style.pointerEvents = this._touchEnabled ? 'auto' : 'none';
    // minimal timeline holder (initialized later when Timeline is defined)
    try { this.tl = new Timeline(this); } catch(e) { /* defined later */ } // link back for event hit tests
  }
  // positioning
  get x(){return this._x;} set x(v){this._x=v; this._dirty=true;}
  get y(){return this._y;} set y(v){this._y=v; this._dirty=true;}
  get width(){return this._width;} set width(v){this._width=v; this._element.style.width = v+"px";}
  get height(){return this._height;} set height(v){this._height=v; this._element.style.height = v+"px";}
  get rotation(){return this._rotation;} set rotation(v){this._rotation=v; this._dirty=true;}
  get scaleX(){return this._scaleX;} set scaleX(v){this._scaleX=v; this._dirty=true;}
  get scaleY(){return this._scaleY;} set scaleY(v){this._scaleY=v; this._dirty=true;}
  get opacity(){return this._opacity;} set opacity(v){this._opacity=v; this._element.style.opacity = v;}
  moveTo(x,y){ this._x=x; this._y=y; this._dirty=true; }
  moveBy(dx,dy){ this._x+=dx; this._y+=dy; this._dirty=true; }

  addChild(node){
    if (node.parentNode) node.parentNode.removeChild(node);
    this.childNodes.push(node);
    node.parentNode = this;
    node.scene = this.scene;
    this._element.appendChild(node._element);
    node.dispatchEvent(new Event(Event.ADDED));
    if (this.scene) node.dispatchEvent(new Event(Event.ADDED_TO_SCENE));
    this.dispatchEvent(new Event(Event.CHILD_ADDED));
    return node;
  }
  removeChild(node){
    const i = this.childNodes.indexOf(node);
    if (i === -1) return null;
    this.childNodes.splice(i,1);
    if (node._element.parentNode === this._element) this._element.removeChild(node._element);
    node.parentNode = null; node.scene = null;
    node.dispatchEvent(new Event(Event.REMOVED));
    this.dispatchEvent(new Event(Event.CHILD_REMOVED));
    return node;
  }
  remove(){ if (this.parentNode) this.parentNode.removeChild(this); }

  _update(){
    if (!this.visible) this._element.style.display = 'none';
    else this._element.style.display = '';
    if (this._dirty) {
      DomUtil.setTransform(this._element, {x:this._x,y:this._y,rotation:this._rotation,scaleX:this._scaleX,scaleY:this._scaleY});
      this._dirty = false;
    }
    // propagate to children
    for (let i=0;i<this.childNodes.length;i++) this.childNodes[i]._update();
  }
}

export class Group extends Node {
  constructor(){
    super();
    this._element.classList.add('enchant-group');
  }
}

export class Entity extends Node {
  constructor(width=0,height=0){
    super();
    this.width = width; this.height = height;
    this.backgroundColor = '';
    this._element.classList.add('enchant-entity');
  }
  get backgroundColor(){ return this._element.style.backgroundColor; }
  set backgroundColor(v){ this._element.style.backgroundColor = v; }

  // --- Geometry & collisions ---

    // 論理座標（親からの x/y を合成）ヘルパ
    _getGlobalPos(){
      let x = 0, y = 0, n = this;
      while (n){
        if (typeof n._x === 'number') x += n._x;
        if (typeof n._y === 'number') y += n._y;
        if (!n.parentNode) break;
        n = n.parentNode;
      }
      return { x, y };
    }
    getLogicalRect(){
      const p = this._getGlobalPos();
      return { x: p.x, y: p.y, width: this.width||0, height: this.height||0 };
    }
  
  getBoundingRect(){
    const core = Core.instance;
    const stage = core ? core._stage : document.body;
    const srect = stage.getBoundingClientRect();
    const r = this._element.getBoundingClientRect();
    const scale = core ? core.scale : 1;
    return {
      x: (r.left - srect.left) / scale,
      y: (r.top  - srect.top ) / scale,
      width: r.width / scale,
      height: r.height / scale
    };
  }
  intersect(other){
    const a = this.getLogicalRect();
    const b = other.getLogicalRect();
    return (a.x < b.x + b.width && a.x + a.width > b.x &&
            a.y < b.y + b.height && a.y + a.height > b.y);
  }
  within(other, distance){
    const a = this.getLogicalRect();
    const b = other.getLogicalRect();
    const ax = a.x + a.width/2, ay = a.y + a.height/2;
    const bx = b.x + b.width/2, by = b.y + b.height/2;
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx*dx + dy*dy) <= distance;
  }
  hitTest(x, y){
    const a = this.getLogicalRect();
    return (x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height);
  }

  static intersectAABB(a,b){ return Entity.prototype.intersect.call(a,b); }
}

// // =============================
// // FrameOverlay: 最前面フレーム（borderはそのまま表示／partsはfitToCoreで自動再配置）
// // =============================
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




export class Label extends Entity {
  constructor(text=''){
    super();
    this._element.classList.add('enchant-label');
    this.text = text;
    this.color = '#000';
    this.font = '16px sans-serif';
    this.textAlign = 'left';
    this.lineHeight = 1.2;
    this._autoSize = true;
    this.fitToTextWidth = false;
  }
  get text(){ return this._element.textContent; }
  set text(v){ this._element.textContent = v; if (this._autoSize) this._autosize(); }
  get color(){ return this._element.style.color; }
  set color(v){ this._element.style.color = v; }
  get font(){ return this._element.style.font; }
  set font(v){ this._element.style.font = v; if (this._autoSize) this._autosize(); }
  get textAlign(){ return this._element.style.textAlign; }
  set textAlign(v){ this._element.style.textAlign = v; }
  // 背景を確実に見せるための上書きセッター
  get backgroundColor(){ return this._element.style.backgroundColor; }
  set backgroundColor(v){
    this._element.style.backgroundColor = v;
    // 可能なら実寸を確定（0は入れない _autosize により安全）
    if (this._autoSize) this._autosize();
    // まだ 0 の場合は最低限の箱を作る
    if (!this._width)  this.width  = 1;
    if (!this._height){
      const fs = parseFloat(getComputedStyle(this._element).fontSize) || 16;
      const lh = (this.lineHeight || 1.2);
      this.height = Math.ceil(fs * lh);
    }
  }
  // --- Font pieces ---
  get fontSize(){ return parseFloat(this._element.style.fontSize) || 16; }
  set fontSize(px){ this._element.style.fontSize = (px|0) + 'px'; if (this._autoSize) this._autosize(); }

  get fontFamily(){ return this._element.style.fontFamily; }
  set fontFamily(v){
    this._element.style.fontFamily = v;
    // フォントが来たらもう一度実測（フォールバック寸法→本寸法へ）
    this._awaitFontReadyFromFamily(v).then(()=> { if (this._autoSize) this._autosize(); });
  }

  get fontWeight(){ return this._element.style.fontWeight; }
  set fontWeight(v){ this._element.style.fontWeight = v; }

  get fontStyle(){ return this._element.style.fontStyle; }
  set fontStyle(v){ this._element.style.fontStyle = v; }

  get letterSpacing(){ return this._element.style.letterSpacing; }
  set letterSpacing(v){ this._element.style.letterSpacing = v; if (this._autoSize) this._autosize(); }

  // ドロップシャドウ（CSS text-shadow をそのまま設定できる）
  get textShadow(){ return this._element.style.textShadow; }
  set textShadow(v){ this._element.style.textShadow = v; }

  // 縁取り：text-stroke(webkit) か、shadowによる擬似アウトライン
  setStroke(width=2, color='#000', mode='auto'){
    const el = this._element;
    const w = Math.max(0, width|0);
    if (mode === 'stroke' || (mode==='auto' && 'webkitTextStroke' in el.style)){
      el.style.webkitTextStroke = `${w}px ${color}`;
      // 影は消す（お好みで併用してもOK）
      // el.style.textShadow = '';
    } else {
      // text-shadow で8方向のアウトラインを作る
      const offs = [];
      const d = w;
      for (let dx=-d; dx<=d; dx++){
        for (let dy=-d; dy<=d; dy++){
          if (dx===0 && dy===0) continue;
          if (Math.abs(dx)===d || Math.abs(dy)===d) offs.push(`${dx}px ${dy}px 0 ${color}`);
        }
      }
      el.style.textShadow = offs.join(', ');
    }
  }

  // 文字の実測サイズを取得（ボックス幅とは別）
  measureTextSize(){
    const probe = this._element.cloneNode(true);
    const st = probe.style;
    st.position='absolute'; st.left='-99999px'; st.top='-99999px';
    st.width='auto'; st.height='auto'; st.whiteSpace='pre';
    // 見た目に干渉する塗りなどはオフ
    st.background='none'; st.border='0';
    document.body.appendChild(probe);
    const r = probe.getBoundingClientRect();
    document.body.removeChild(probe);
    return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
  }
  get textWidth(){ return this.measureTextSize().width; }

  // 指定した family のロードをゆるく待つ（リンク挿入は loadGoogleFont 側）
  async _awaitFontReadyFromFamily(v){
    if (!document.fonts || !document.fonts.load) return;
    // 先頭の family 名だけ抜き出す
    let fam = (v||'').split(',')[0].trim();
    if ((fam.startsWith('"') && fam.endsWith('"')) || (fam.startsWith("'") && fam.endsWith("'"))) {
      fam = fam.slice(1, -1);
    }
    try { await document.fonts.load(`1em "${fam}"`); } catch(_) {}
  }

  // お好みで：インスタンスから手軽にGoogle Fontを使うヘルパ
  async useGoogleFont(family, opt){
    await loadGoogleFont(family, opt);
    // 既存の family に先頭追加（フォールバック維持）
    const fallback = this.fontFamily || 'system-ui, Arial, sans-serif';
    this.fontFamily = `"${family}", ${fallback}`;
    return this;
  }

  // よく使うスタイル適用
  applyStyle(name){
    const p = Label.styles?.[name];
    if (!p) return this;
    Object.keys(p).forEach(k=>{ this[k] = p[k]; });
    return this;
  }
  

  _autosize(){
    // measure
    this._element.style.whiteSpace = 'pre';
    const rect = this._element.getBoundingClientRect();
    if (!this._width) this.width = Math.ceil(rect.width);
    if (!this._height) this.height = Math.ceil(rect.height);
    // ★ 変更: フラグONのときだけ「文字幅にぴったり」へ
    if (this.fitToTextWidth) {
      const tw = this.textWidth;
      if (this.width !== tw) this.width = tw;
    }
  }
}


export class Sprite extends Entity {
  constructor(width=0,height=0){
    super(width,height);
    this._element.classList.add('enchant-sprite');
    this._image = null; // HTMLImageElement or URL string
    this._frame = 0;          // numeric index or [x,y]
    this._frames = null;      // optional array of [x,y]
    this._sheetWidth = 0;     // natural image width
    this._sheetHeight = 0;    // natural image height

    this._element.style.overflow = 'hidden';
    this._imgEl = document.createElement('img');
    this._imgEl.draggable = false;
    this._imgEl.style.position = 'absolute';
    this._imgEl.style.left = '0px';
    this._imgEl.style.top = '0px';
    this._imgEl.style.width = 'auto';
    this._imgEl.style.height = 'auto';
    this._imgEl.style.pointerEvents = 'none';
    this._element.appendChild(this._imgEl);
  }
  get image(){ return this._image; }
  set image(v){
    if (typeof v === 'string') {
      this._image = v;
      this._imgEl.onload = ()=>{ this._sheetWidth = this._imgEl.naturalWidth; this._sheetHeight = this._imgEl.naturalHeight; this._updateFrame(); };
      this._imgEl.src = v;
    } else if (v instanceof HTMLImageElement) {
      this._image = v; this._imgEl.src = v.src;
      if (v.complete) { this._sheetWidth = v.naturalWidth; this._sheetHeight = v.naturalHeight; this._updateFrame(); }
      else this._imgEl.onload = ()=>{ this._sheetWidth = this._imgEl.naturalWidth; this._sheetHeight = this._imgEl.naturalHeight; this._updateFrame(); };
    } else if (v && v.src) {
      this._image = v; this._imgEl.src = v.src;
      this._imgEl.onload = ()=>{ this._sheetWidth = this._imgEl.naturalWidth; this._sheetHeight = this._imgEl.naturalHeight; this._updateFrame(); };
    }
  }
  get frames(){ return this._frames; }
  set frames(arr){ this._frames = Array.isArray(arr) ? arr : null; this._updateFrame(); }

  get frame(){ return this._frame; }
  set frame(v){ this._frame = v; this._updateFrame(); }

  _updateFrame(){
    if (!this._imgEl || !this._imgEl.src) return;
    const fw = this.width || 0, fh = this.height || 0;
    if (!fw || !fh) return; // need sprite size

    // ensure the <img> is at natural size so offset works
    this._imgEl.style.width = this._sheetWidth + 'px';
    this._imgEl.style.height = this._sheetHeight + 'px';

    let ix = 0, iy = 0;
    if (Array.isArray(this._frame)) {
      ix = (+this._frame[0])|0; iy = (+this._frame[1])|0;
    } else if (this._frames && this._frames.length) {
      const f = this._frames[(this._frame|0) % this._frames.length];
      ix = (f && f[0])|0; iy = (f && f[1])|0;
    } else {
      // auto grid: horizontal strip -> wrap by sheet width
      const cols = Math.max(1, Math.floor(this._sheetWidth / fw));
      const idx = (this._frame|0);
      ix = idx % cols; iy = Math.floor(idx / cols);
    }
    const offX = -(ix * fw);
    const offY = -(iy * fh);
    this._imgEl.style.left = offX + 'px';
    this._imgEl.style.top  = offY + 'px';
  }

  // --- Auto frame animation helper ---
  animate(frames, interval=6, options={}){
    this.stopAnimation();
    const list = Array.isArray(frames) ? frames.slice() : [];
    if (!list.length) return this;
    const { loop=true, pingpong=false, startIndex=0 } = (options||{});
    this._animFrames = list;
    this._animInterval = Math.max(1, interval|0);
    this._animIndex = Math.min(Math.max(0, startIndex|0), list.length-1);
    this._animDir = 1;
    this._animCounter = 0;
    // 初期適用
    this.frame = this._animFrames[this._animIndex];
    this._animBind = () => {
      this._animCounter++;
      if (this._animCounter % this._animInterval !== 0) return;
      if (pingpong){
        this._animIndex += this._animDir;
        if (this._animIndex >= this._animFrames.length-1){ this._animIndex = this._animFrames.length-1; this._animDir = -1; }
        else if (this._animIndex <= 0){
          this._animIndex = 0; this._animDir = 1;
          if (!loop) { this.stopAnimation(); return; }
        }
      } else {
        this._animIndex++;
        if (this._animIndex >= this._animFrames.length){
          if (loop) this._animIndex = 0;
          else { this._animIndex = this._animFrames.length-1; this.stopAnimation(); return; }
        }
      }
      this.frame = this._animFrames[this._animIndex];
    };
    this.on(Event.ENTER_FRAME, this._animBind);
    return this;
  }
  stopAnimation(){
    if (this._animBind){ this.removeEventListener(Event.ENTER_FRAME, this._animBind); this._animBind = null; }
    this._animFrames = null; this._animCounter = 0;
    return this;
  }

}

// =============================
// Shapes (DOM/CSSベース)
// =============================
export class Shape extends Entity {
  constructor(width=0, height=0){
    super(width, height);
    this._element.classList.add('enchant-shape');
    this._fillColor = 'transparent';
    this._strokeColor = 'transparent';
    this._strokeWidth = 0;
    this._cornerRadius = 0;
    this._applyStyle();
  }
  _applyStyle(){
    const st = this._element.style;
    st.backgroundColor = this._fillColor || 'transparent';
    st.borderStyle = 'solid';
    st.borderColor = this._strokeColor || 'transparent';
    st.borderWidth = (this._strokeWidth|0) + 'px';
    st.borderRadius = (this._cornerRadius|0) + 'px';
  }
  get fillColor(){ return this._fillColor; }
  set fillColor(v){ this._fillColor = v; this._applyStyle(); }

  get strokeColor(){ return this._strokeColor; }
  set strokeColor(v){ this._strokeColor = v; this._applyStyle(); }

  get strokeWidth(){ return this._strokeWidth; }
  set strokeWidth(v){ this._strokeWidth = v|0; this._applyStyle(); }

  get cornerRadius(){ return this._cornerRadius; }
  set cornerRadius(v){ this._cornerRadius = v|0; this._applyStyle(); }
}

export class Rect extends Shape {
  constructor(width=32, height=32, options={}){
    super(width, height);
    this._element.classList.add('enchant-shape-rect');
    if (options.fillColor     != null) this.fillColor = options.fillColor;
    if (options.strokeColor   != null) this.strokeColor = options.strokeColor;
    if (options.strokeWidth   != null) this.strokeWidth = options.strokeWidth;
    if (options.cornerRadius  != null) this.cornerRadius = options.cornerRadius;
  }
}

export class Circle extends Shape {
  constructor(diameter=32, options={}){
    super(diameter, diameter);
    this._element.classList.add('enchant-shape-circle');
    if (options.fillColor     != null) this.fillColor = options.fillColor;
    if (options.strokeColor   != null) this.strokeColor = options.strokeColor;
    if (options.strokeWidth   != null) this.strokeWidth = options.strokeWidth;
    // 真円にする
    const st = this._element.style;
    st.borderRadius = '50%';
  }
}


// typo-tolerant alias
export const Splite = Sprite;

// =============================
// Scene & Core (stage management, loop, input)
// =============================
export class Scene extends Group {
  constructor(){
    super();
    this._element.classList.add('enchant-scene');
    // Fill stage so backgroundColor shows
    const st = this._element.style; st.left='0px'; st.top='0px'; st.width='100%'; st.height='100%';
    this.backgroundColor = '';
  }
  get backgroundColor(){ return this._element.style.backgroundColor; }
  set backgroundColor(v){ this._element.style.backgroundColor = v; }
}

export class Core extends EventTarget {
  constructor(width=320, height=320){
    super();
    if (!document || !document.body) throw new Error("document.body is null — create Core after DOM is ready");

    // stage root
    // global-ish handle for compatibility
    Core.instance = this;
    this._stage = document.getElementById('enchant-stage') || DomUtil.create('div','enchant-stage');
    if (!this._stage.parentNode) document.body.appendChild(this._stage);
    this._stage.style.position = 'relative';
    this._stage.style.overflow = 'hidden';
    this._stage.style.userSelect = 'none';

    this._width = width; this._height = height; this._scale = 1;
    this._applyStageSize();

    this.fps = 30;
    this.frame = 0;
    this.running = false;
    this.ready = false;
    this.currentTime = 0;

    this.assets = {};
    this._preloadList = [];

    this._scenes = [];
    this.currentScene = null;
    this.rootScene = new Scene();
    this.pushScene(this.rootScene);

    this.input = Object.create(null);
    this._setupInput();

    // Pointer → touch-like events
    this._mouseDown = false;
    this._stage.addEventListener('mousedown', this._handlePointerDown, true);
    this._stage.addEventListener('mousemove', this._handlePointerMove, true);
    this._stage.addEventListener('mouseup', this._handlePointerUp, true);
    this._stage.addEventListener('touchstart', this._handleTouchStart, {passive:false});
    this._stage.addEventListener('touchmove', this._handleTouchMove, {passive:false});
    this._stage.addEventListener('touchend', this._handleTouchEnd, {passive:false});

    // resize observer (optional)
    window.addEventListener('resize', ()=> this._dispatchCoreResizeEvent());
  }

  get width(){return this._width;} set width(v){ this._width=v; this._applyStageSize(); this._dispatchCoreResizeEvent(); }
  get height(){return this._height;} set height(v){ this._height=v; this._applyStageSize(); this._dispatchCoreResizeEvent(); }
  get scale(){return this._scale;} set scale(v){ this._scale=v; this._applyStageSize(); this._dispatchCoreResizeEvent(); }

  _applyStageSize(){
    this._stage.style.width = Math.floor(this._width * this._scale) + 'px';
    this._stage.style.height = Math.floor(this._height * this._scale) + 'px';
  }
  _dispatchCoreResizeEvent(){
    const e = new Event(Event.CORE_RESIZE); e.width=this._width; e.height=this._height; e.scale=this._scale;
    this.dispatchEvent(e);
    this._scenes.forEach(sc=> sc.dispatchEvent(e));
  }

  // Scene stack
  pushScene(scene){
    this._stage.appendChild(scene._element);
    if (this.currentScene) this.currentScene.dispatchEvent(new Event(Event.EXIT));
    scene.scene = scene; // scene is its own scene
    // propagate scene reference to descendants
    (function setScene(node, sc){ node.scene = sc; node.childNodes.forEach(c=> setScene(c, sc)); })(scene, scene);
    this.currentScene = scene;
    this.currentScene.dispatchEvent(new Event(Event.ENTER));
    this._scenes.push(scene); return scene;
  }
  popScene(){
    if (this.currentScene === this.rootScene) return this.currentScene;
    const old = this._scenes.pop();
    if (old && old._element.parentNode === this._stage) this._stage.removeChild(old._element);
    old.dispatchEvent(new Event(Event.EXIT));
    this.currentScene = this._scenes[this._scenes.length-1] || this.rootScene;
    this.currentScene.dispatchEvent(new Event(Event.ENTER));
    return old;
  }
  replaceScene(scene){
    const removed = this.popScene();
    // aggressive cleanup à la memory-leak fix: remove all children from removed scene
    if (removed){
      while (removed.childNodes.length) removed.removeChild(removed.childNodes[0]);
    }
    return this.pushScene(scene);
  }
  removeScene(scene){
    if (this.currentScene === scene) return this.popScene();
    const i = this._scenes.indexOf(scene);
    if (i !== -1){
      this._scenes.splice(i,1);
      if (scene._element.parentNode === this._stage) this._stage.removeChild(scene._element);
      return scene;
    }
    return null;
  }

  // Loop
  start(){
    if (this.running) return;
    this.running = true; this.ready = true; this.frame = 0; this.currentTime = performance.now();
    const run = (t)=>{
      if (!this.ready) return;
      const now = performance.now();
      const e = new Event(Event.ENTER_FRAME); e.elapsed = now - this.currentTime;

      // traverse nodes depth-first
      const stack = [...this.currentScene.childNodes];
      for (let i=0;i<stack.length;i++){
        const n = stack[i]; n.age++; n.dispatchEvent(e); n._update();
        if (n.childNodes && n.childNodes.length) stack.push(...n.childNodes);
      }
      this.currentScene.age = (this.currentScene.age|0) + 1;
      this.currentScene.dispatchEvent(e);
      this.dispatchEvent(e);

      this.dispatchEvent(new Event(Event.EXIT_FRAME));
      this.frame++; this.currentTime = now;
      const delay = Math.max(0, 1000/this.fps - (performance.now() - now));
      if (this.fps >= 60 || delay <= 16) requestAnimationFrame(run);
      else setTimeout(()=> requestAnimationFrame(run), delay);
    };
    requestAnimationFrame(run);
    // show loading scene if preloads exist
    if (this._preloadList.length){
      const loading = this._createLoadingScene();
      this.pushScene(loading);
      this._doPreload().then(()=>{
        // drop loading scene
        this.removeScene(loading);
        this.dispatchEvent(new Event(Event.LOAD));
      });
    } else {
      this.dispatchEvent(new Event(Event.LOAD));
    }
  }
  pause(){ this.ready = false; }
  resume(){ if (this.running && !this.ready){ this.ready=true; this.start(); } }
  stop(){ this.ready=false; this.running=false; }

  // Asset loading (basic)

    // ---- Runtime asset loading (non-blocking prefetch) ----
    async loadAssets(assets, { emitProgress = true } = {}) {
      if (assets && !Array.isArray(assets)) assets = [assets];
      assets = (assets || []).filter(Boolean);
      if (!assets.length) return {};
  
      const total = assets.length;
      let loaded = 0;
      const onProgress = (path)=> {
        if (!emitProgress) return;
        const ev = new Event(Event.PROGRESS);
        ev.phase = 'runtime';
        ev.loaded = loaded;
        ev.total = total;
        ev.path = path;
        // 進行中のシーンに通知
        if (this.currentScene) this.currentScene.dispatchEvent(ev);
        // Coreにも流す
        this.dispatchEvent(ev);
      };
  
      const results = {};
      for (const path of assets) {
        // 既に読み込み済みならスキップ
        if (this.assets[path]) { results[path] = this.assets[path]; loaded++; onProgress(path); continue; }
        results[path] = await this._loadOne(path); // 1件読み込み
        loaded++; onProgress(path);
      }
      return results;
    }
  
    async ensureAssets(assets, opts) {
      // 未ロードのみ読み込む
      if (assets && !Array.isArray(assets)) assets = [assets];
      const missing = (assets || []).filter(p => !this.assets[p]);
      return this.loadAssets(missing, opts);
    }
  
    prefetch(assets, opts) { return this.loadAssets(assets, opts); }
  
    getAsset(path){ return this.assets[path]; }
    hasAsset(path){ return !!this.assets[path]; }
    unloadAssets(paths){
      if (paths && !Array.isArray(paths)) paths = [paths];
      (paths || []).forEach(p => { delete this.assets[p]; });
    }
  
  //////

  // preload
  preload(...assets){
    if (assets.length===1 && Array.isArray(assets[0])) assets = assets[0];
    this._preloadList.push(...assets);
    return this;
  }

  //---- _loadOne ----
  async _loadOne(path){
    const ext = (path.split('.').pop()||'').toLowerCase();
    if (['png','jpg','jpeg','gif','bmp','webp','svg'].includes(ext)){
      const img = await new Promise((res, rej)=>{
        const im = new Image();
        im.onload = ()=> res(im);
        im.onerror = (e)=> rej(e || new Error('image load error: '+path));
        im.src = path;
      });
      // 可能なら描画前デコード（対応ブラウザのみ）
      if (img.decode) { try { await img.decode(); } catch(_){} }
      this.assets[path] = img; return img;
    } else if (['mp3','aac','m4a','wav','ogg','flac','webm'].includes(ext)){
      // 簡易: HTMLAudio（即時にassetsへ）
      const audio = new Audio(); audio.src = path;
      this.assets[path] = audio; return audio;
    } else {
      const txt = await fetch(path).then(r=> r.ok? r.text(): Promise.reject(new Error(r.status+': '+path)));
      this.assets[path] = txt; return txt;
    }
  }

  //////

  //---- _doPreload ----
  async _doPreload(){
    const total = this._preloadList.length; let loaded=0;
    const onProgress = ()=>{
      const ev = new Event(Event.PROGRESS);
      ev.phase = 'preload';
      ev.loaded = loaded; ev.total = total;
      if (this.currentScene) this.currentScene.dispatchEvent(ev);
      this.dispatchEvent(ev);
    };
    onProgress();
    for (const path of this._preloadList){
      await this._loadOne(path);
      loaded++; onProgress();
    }
    this._preloadList = [];
  }

  _createLoadingScene(){
    const s = new Scene(); s.backgroundColor = '#000';
    const lbl = new Label('Loading...');
    lbl.color = '#fff'; lbl.font = 'bold 18px system-ui, sans-serif';
    lbl.width = this.width; lbl.height = 24; lbl.x = 0; lbl.y = (this.height-24)/2; lbl.textAlign='center';
    s.addChild(lbl);
    s.on(Event.PROGRESS, (e)=>{ lbl.text = `Loading ${e.loaded}/${e.total}`; });
    return s;
  }

  // Input (very light enchant-like)
  keybind(keyCode, name){
    if (!this._keybind) this._keybind = {};
    this._keybind[keyCode] = name; this.input[name] = false;
    return this;
  }
  keyunbind(keyCode){ if (!this._keybind) return this; const name=this._keybind[keyCode]; delete this._keybind[keyCode]; delete this.input[name]; return this; }
  changeButtonState(button, bool){
    if (this.input[button] === bool) return;
    this.input[button] = bool;
    const type = bool ? Event.INPUT_START : Event.INPUT_END;
    this.dispatchEvent(new Event(type));
    const ev = new Event(bool ? (button+'buttondown') : (button+'buttonup'));
    this.dispatchEvent(ev); if (this.currentScene) this.currentScene.dispatchEvent(ev);
  }
  _setupInput(){
    this._keybind = {37:'left',38:'up',39:'right',40:'down'};
    ['keydown','keyup'].forEach(type=>{
      document.addEventListener(type, (e)=>{
        if (!this.running || !this.ready) return;
        const name = this._keybind[e.keyCode];
        if (!name) return;
        if ([37,38,39,40,32].includes(e.keyCode)) { e.preventDefault(); }
        this.changeButtonState(name, type==='keydown');
      }, true);
    });
  }

  // Pointer → dispatch to top-most node under pointer (simple hit-test by element)
  _localXY(pageX, pageY){
    const rect = this._stage.getBoundingClientRect();
    const x = (pageX - (rect.left + window.scrollX)) / this._scale;
    const y = (pageY - (rect.top + window.scrollY)) / this._scale;
    return {x,y};
  }
  _dispatchTouchLike(type, pageX, pageY, ident='mouse'){
    const {x,y} = this._localXY(pageX,pageY);
    const ev = new Event(type); ev.x=x; ev.y=y; ev.localX=x; ev.localY=y;
    // target: closest node element at point
    const el = document.elementFromPoint(pageX - window.scrollX, pageY - window.scrollY);
    let node = null; if (el) { let cur = el; while (cur && !node){ node = cur.__node__; cur = cur.parentElement; }
    }
    if (!node) node = this.currentScene;
    if (node) node.dispatchEvent(ev);
  }
  _handlePointerDown = (e)=>{ if (e.button!==0) return; e.preventDefault(); this._mouseDown=true; this._dispatchTouchLike(Event.TOUCH_START, e.pageX, e.pageY); };
  _handlePointerMove = (e)=>{ if (!this._mouseDown) return; e.preventDefault(); this._dispatchTouchLike(Event.TOUCH_MOVE, e.pageX, e.pageY); };
  _handlePointerUp = (e)=>{ if (!this._mouseDown) return; e.preventDefault(); this._mouseDown=false; this._dispatchTouchLike(Event.TOUCH_END, e.pageX, e.pageY); };
  _handleTouchStart = (e)=>{ if (!this.running) return; for (const t of e.changedTouches){ e.preventDefault(); this._dispatchTouchLike(Event.TOUCH_START, t.pageX, t.pageY, t.identifier); } };
  _handleTouchMove = (e)=>{ if (!this.running) return; for (const t of e.changedTouches){ e.preventDefault(); this._dispatchTouchLike(Event.TOUCH_MOVE, t.pageX, t.pageY, t.identifier); } };
  _handleTouchEnd = (e)=>{ if (!this.running) return; for (const t of e.changedTouches){ e.preventDefault(); this._dispatchTouchLike(Event.TOUCH_END, t.pageX, t.pageY, t.identifier); } };
}

// Alias for backward-compatibility
export const Game = Core;


// -----------------------------
// Timeline (parallel-capable, tl-like)
// -----------------------------
const TL_Easing = {
  linear: t => t,
  easeInQuad: t => t*t,
  easeOutQuad: t => t*(2 - t),
  easeInOutQuad: t => (t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t),
  easeInCubic: t => t*t*t,
  easeOutCubic: t => (--t)*t*t + 1,
  easeInOutCubic: t => t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2) + 1
};

class TimelineAction {
  constructor(duration, updater, onend){
    this.left = duration|0;
    this.duration = duration|0;
    this.updater = updater || null;
    this.onend = onend || null;
    // lazy-captured start values
    this.from = null;
    // optional fields used by特殊アクション
    this.keys = null;   // ['x','y'] など
    this.to = null;     // 絶対値ターゲット
    this.by = null;     // 相対量 {x:dx,y:dy}
    this.easing = TL_Easing.linear;
  }
}

class Timeline {
  constructor(node){
    this.node = node;
    // キューは「セグメント」の配列。各セグメントは同時実行アクションの配列
    this.queue = [];
    this.looping = false;
    this._andNext = false; // 直前の .and() により「次を同一セグメントへ」フラグ
    this._bind = (e)=> this._tick(e);
    node.on(Event.ENTER_FRAME, this._bind);
  }

  // ---- キュー操作 ----
  clear(){ this.queue.length = 0; return this; }
  loop(){ this.looping = true; return this; }
  unloop(){ this.looping = false; return this; }
  and(){ this._andNext = true; return this; }

  delay(frames){
    const act = new TimelineAction(frames, ()=>{});
    return this._pushAct(act);
  }

  then(fn){
    const act = new TimelineAction(1, ()=>{}, fn);
    return this._pushAct(act);
  }

  _pushAct(act){
    // 直前に .and() が呼ばれていれば、最後のセグメントに積む
    if (this._andNext && this.queue.length){
      this.queue[this.queue.length - 1].push(act);
      this._andNext = false; // and() は「次の1件だけ」に作用
    } else {
      this.queue.push([act]);
    }
    return this;
  }

  _mkTween(to, frames, props, easing='linear'){
    const node = this.node;
    const easeFn = (typeof easing === 'function') ? easing : (TL_Easing[easing] || TL_Easing.linear);
    const act = new TimelineAction(frames, null, null);
    act.keys = (props && props.slice()) || Object.keys(to);
    act.to = Object.assign({}, to);
    act.easing = easeFn;
    act.updater = ()=>{
      if (!act.from){
        act.from = {};
        act.keys.forEach(k=> act.from[k] = node[k]);
        // moveBy系は act.by から to を算出（初回に基準を取る）
        if (act.by){
          act.to = { x: act.from.x + (act.by.x||0), y: act.from.y + (act.by.y||0) };
        }
        // scaleTo で __fitShrink を持つノードなら最終値を補正（任意：CharSprite等の縮小と両立）
        if (act.keys.length === 2 && act.keys[0]==='scaleX' && act.keys[1]==='scaleY' && node.__fitShrink){
          act.to = { scaleX: (+act.to.scaleX||0) * node.__fitShrink, scaleY: (+act.to.scaleY||0) * node.__fitShrink };
        }
      }
      const lin = 1 - (act.left-1)/Math.max(1, act.duration);
      const t = act.easing(Math.max(0, Math.min(1, lin)));
      act.keys.forEach(k=>{
        const s = +act.from[k] || 0;
        const e = +act.to[k]   || 0;
        node[k] = s + (e - s) * t;
      });
    };
    act.onend = ()=>{
      // 終了時は最終値を確定（回転だけは 0..360 正規化）
      act.keys.forEach(k=>{
        if (k === 'rotation'){
          let r = (+act.to[k]||0) % 360; if (r < 0) r += 360; this.node[k] = r;
        } else {
          this.node[k] = act.to[k];
        }
      });
    };
    return act;
  }

  // ---- API ----
  moveTo(x,y,frames,easing){ return this._pushAct(this._mkTween({x,y}, frames, ['x','y'], easing)); }

  moveBy(dx,dy,frames,easing){
    const act = this._mkTween({}, frames, ['x','y'], easing);
    act.by = { x:+dx||0, y:+dy||0 }; // from を掴んだ瞬間に to を計算
    return this._pushAct(act);
  }

  // scaleTo(sx, sy, frames, easing)
  scaleTo(sx, sy, frames, easing){
    if (sy == null) sy = sx;
    return this._pushAct(this._mkTween({ scaleX:+sx||0, scaleY:+sy||0 }, frames, ['scaleX','scaleY'], easing));
  }

  rotateTo(deg,frames,easing){ return this._pushAct(this._mkTween({rotation:+deg||0}, frames, ['rotation'], easing)); }

  fadeTo(opacity,frames,easing){ return this._pushAct(this._mkTween({opacity:+opacity||0}, frames, ['opacity'], easing)); }

  // ---- ループ駆動 ----
  _tick(){
    if (!this.queue.length) return;
    const seg = this.queue[0]; // 同時実行アクションの束
    // まず全アクションを1ステップ更新
    for (const act of seg){
      if (act.left > 0){
        act.updater && act.updater();
        act.left--;
      }
    }
    // 束の中で「完了したもの」を確認
    const allDone = seg.every(a => a.left <= 0);
    if (allDone){
      // onend を呼ぶ（順序はセグメント内の並び順）
      for (const act of seg){ act.onend && act.onend(); }
      // セグメントを外す
      this.queue.shift();
      // ループ時は同じセグメントを末尾へ戻す（状態初期化）
      if (this.looping){
        for (const act of seg){
          act.left = act.duration;
          act.from = null;
          // moveBy は毎サイクル from 基準で再計算される（上の updater で対応済み）
        }
        this.queue.push(seg);
      }
    }
  }
}



// // -----------------------------
// // Timeline (very small, tl-like)
// // -----------------------------
// // --- Easing functions ---
// const Easing = {
//   linear: t => t,
//   easeInQuad: t => t*t,
//   easeOutQuad: t => t*(2 - t),
//   easeInOutQuad: t => (t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t),
//   easeInCubic: t => t*t*t,
//   easeOutCubic: t => (--t)*t*t + 1,
//   easeInOutCubic: t => t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2) + 1
// };

// class TimelineAction {
//   constructor(duration, updater, onend){ this.left=duration|0; this.duration=duration|0; this.updater=updater; this.onend=onend||null; }
// }
// class Timeline {
//   constructor(node){ this.node=node; this.queue=[]; this.looping=false; this._bind = (e)=> this._tick(e); node.on(Event.ENTER_FRAME, this._bind); }
//   _push(act){ this.queue.push(act); return this; }
//   clear(){ this.queue.length=0; return this; }
//   loop(){ this.looping=true; return this; }
//   unloop(){ this.looping=false; return this; }
//   delay(frames){ return this._push(new TimelineAction(frames, ()=>{})); }
//   then(fn){ return this._push(new TimelineAction(1, ()=>{}, fn)); }
//   _tween(to, frames, props, easing='linear'){
//     const node = this.node;
//     const keys = props || Object.keys(to);
//     const easeFn = (typeof easing === 'function') ? easing : (Easing[easing] || Easing.linear);
//     const act = new TimelineAction(frames, null, null);
//     act.to = Object.assign({}, to);
//     act.keys = keys.slice();
//     act.from = null; // lazily capture at action start
//     act.easing = easeFn;
//     act.updater = ()=>{
//       if (!act.from){
//         act.from = {};
//         act.keys.forEach(k=> act.from[k] = node[k]);
//       }
//       const t = 1 - (act.left-1)/Math.max(1, act.duration);
//       const te = act.easing(t);
//       act.keys.forEach(k=>{
//         const s = +act.from[k] || 0;
//         const e = +act.to[k] || 0;
//         node[k] = s + (e - s) * te;
//       });
//     };
//     act.onend = ()=>{ act.keys.forEach((key)=> { node[key] = act.to[key]; }); };
//     return this._push(act);
//   }
    
//   moveTo(x,y,frames,easing){ return this._tween({x,y}, frames, null, easing); }

//   moveBy(dx,dy,frames,easing){
//      const act = new TimelineAction(frames, null, null);
//      const node = this.node;
//      act.keys = ['x','y'];
//      act.by = { x: dx, y: dy };
//      act.from = null; act.to = null;
//      act.easing = (typeof easing === 'function') ? easing : (Easing[easing] || Easing.linear);
//      act.updater = ()=>{
//        if (!act.from){
//          act.from = { x: node.x, y: node.y };
//          act.to   = { x: act.from.x + act.by.x, y: act.from.y + act.by.y };
//        }
//        const t = 1 - (act.left-1)/Math.max(1, act.duration);
//        const te = act.easing(t);
//        node.x = act.from.x + (act.to.x - act.from.x) * te;
//        node.y = act.from.y + (act.to.y - act.from.y) * te;
//      };
//      act.onend = ()=>{ node.x = act.to.x; node.y = act.to.y; };
//      return this._push(act);
//    }

//   scaleTo(sx,sy,frames,easing){ if (sy==null) sy=sx; return this._tween({scaleX:sx, scaleY:sy}, frames, ['scaleX','scaleY'], easing); }
//   //rotateTo(deg,frames,easing){ return this._tween({rotation:deg}, frames, ['rotation'], easing); }
//   rotateTo(deg,frames,easing){
//     // 通常の tween をキューに積む
//     this._tween({rotation:deg}, frames, ['rotation'], easing);
//     // 直近に push されたアクションを取り出し、終了時に正規化
//     const act = this.queue[this.queue.length - 1];
//     const prevOnend = act.onend;
//     act.onend = ()=>{
//       if (prevOnend) prevOnend();
//       const n = this.node;
//       let r = n.rotation % 360;
//       if (r < 0) r += 360;
//       n.rotation = r;
//     };
//     return this;
//   }
  
//   fadeTo(opacity,frames,easing){ return this._tween({opacity}, frames, ['opacity'], easing); }

//   _tick(e){ 
//     if (!this.queue.length) return; const head=this.queue[0]; 
//     if (head.left>0){ head.updater && head.updater(e); head.left--; } 
//     if (head.left<=0){
//       head.onend && head.onend();
//       this.queue.shift();
//       if (this.looping){
//         head.left = head.duration;     // ← 残りフレームをリセット
//         head.from = null;              // ← 次サイクル開始時に再キャプチャ
//         this.queue.push(head);
//       }
//     }
//   }
// }


// =============================
// TileLayer (DOM-based tile map)
// =============================
// export class TileLayer extends Entity {
//   constructor(tileWidth, tileHeight, cols=0, rows=0){
//     super(cols*tileWidth, rows*tileHeight);
//     this._element.classList.add('enchant-tilelayer');
//     this.tileWidth = tileWidth|0; this.tileHeight = tileHeight|0;
//     this.cols = cols|0; this.rows = rows|0;

//     this.tileset = null;       // HTMLImageElement or URL
//     this.tilesetURL = '';
//     this.tilesetCols = 0;      // columns in tileset image
//     this.tilesetRows = 0;
//     this.tileSpacing = 0;      // px
//     this.tileMargin  = 0;      // px

//     this.data = [];            // 2D: rows x cols, 1..N=tileIndex, 0/-1=empty
//     this._cells = [];          // DOM cell divs (rows*cols)

//     this._ensureGrid();
//   }
//   setTileset(img){
//     if (typeof img === 'string'){
//       this.tilesetURL = img; this.tileset = new Image();
//       this.tileset.onload = ()=>{ this._computeAtlas(); this.redraw(); };
//       this.tileset.src = img;
//     } else if (img instanceof HTMLImageElement){
//       this.tileset = img; this.tilesetURL = img.src; this._computeAtlas(); this.redraw();
//     } else if (img && img.src){
//       this.tileset = img; this.tilesetURL = img.src; this._computeAtlas(); this.redraw();
//     }
//     return this;
//   }
//   _computeAtlas(){
//     const W = this.tileset?.naturalWidth || 0, H = this.tileset?.naturalHeight || 0;
//     const tw = this.tileWidth, th = this.tileHeight, sp = this.tileSpacing, mg = this.tileMargin;
//     if (!tw || !th || !W || !H) { this.tilesetCols = this.tilesetRows = 0; return; }
//     this.tilesetCols = Math.max(1, Math.floor((W - mg + sp) / (tw + sp)));
//     this.tilesetRows = Math.max(1, Math.floor((H - mg + sp) / (th + sp)));
//   }
//   setSize(cols, rows){
//     this.cols = cols|0; this.rows = rows|0;
//     this.width = this.cols * this.tileWidth; this.height = this.rows * this.tileHeight;
//     this._ensureGrid();
//     return this;
//   }
//   setData(data){
//     this.rows = data.length|0; this.cols = (data[0]?.length|0) || 0;
//     this.width = this.cols * this.tileWidth; this.height = this.rows * this.tileHeight;
//     this.data = data;
//     this._ensureGrid();
//     this.redraw();
//     return this;
//   }
//   setTile(x, y, index){
//     if (x<0||y<0||x>=this.cols||y>=this.rows) return this;
//     this.data[y][x] = index|0; this._updateCell(x,y);
//     return this;
//   }
//   getTile(x,y){ if (x<0||y<0||x>=this.cols||y>=this.rows) return 0; return this.data[y][x]|0; }

//   _ensureGrid(){
//     const need = this.cols * this.rows;
//     while (this._cells.length > need){
//       const c = this._cells.pop(); if (c.parentNode) c.parentNode.removeChild(c);
//     }
//     while (this._cells.length < need){
//       const cell = document.createElement('div');
//       cell.className = 'enchant-tilecell';
//       const st = cell.style;
//       st.position='absolute';
//       st.width=this.tileWidth+'px';
//       st.height=this.tileHeight+'px';
//       st.backgroundRepeat='no-repeat';
//       st.imageRendering='pixelated';
//       this._element.appendChild(cell);
//       this._cells.push(cell);
//     }
//     for (let y=0; y<this.rows; y++){
//       for (let x=0; x<this.cols; x++){
//         const i = y*this.cols + x;
//         const st = this._cells[i].style;
//         st.left = (x*this.tileWidth)+'px';
//         st.top  = (y*this.tileHeight)+'px';
//       }
//     }
//   }
//   _tileToBackground(index){
//     if (!this.tileset || !this.tilesetCols) return null;
//     const idx = (index|0) - 1; if (idx < 0) return null; // 0/-1 => empty
//     const tw=this.tileWidth, th=this.tileHeight, sp=this.tileSpacing, mg=this.tileMargin;
//     const cols = this.tilesetCols;
//     const ix = idx % cols; const iy = Math.floor(idx / cols);
//     const x = mg + ix * (tw + sp);
//     const y = mg + iy * (th + sp);
//     return { bg: `url(\"${this.tilesetURL}\")`, pos: `-${x}px -${y}px` };
//   }
//   _updateCell(x,y){
//     const i = y*this.cols + x;
//     const cell = this._cells[i]; if (!cell) return;
//     const index = this.getTile(x,y);
//     const st = cell.style;
//     const conf = this._tileToBackground(index);
//     if (!conf){ st.backgroundImage=''; st.display='none'; }
//     else { st.display=''; st.backgroundImage=conf.bg; st.backgroundPosition=conf.pos; }
//   }
//   redraw(){
//     if (!this.data || !this.data.length) return;
//     for (let y=0; y<this.rows; y++)
//       for (let x=0; x<this.cols; x++)
//         this._updateCell(x,y);
//   }
// }



// =============================
// TileMap (multi-layer, DOM-based)
// =============================
export class TileMap extends Entity {
  /**
   * @param {number} tileWidth  - タイル幅(px)
   * @param {number} tileHeight - タイル高(px)
   * @param {number} cols       - 横タイル数
   * @param {number} rows       - 縦タイル数
   */
  constructor(tileWidth, tileHeight, cols=0, rows=0){
    super(cols*tileWidth, rows*tileHeight);
    this._element.classList.add('enchant-tilemap');

    this.tileWidth  = tileWidth|0;
    this.tileHeight = tileHeight|0;
    this.cols = cols|0;
    this.rows = rows|0;

    // レイヤー配列
    // each: { name, wrapper, cells[], data, visible, collidable, solidFn, tileset, tilesetURL, tilesetCols, tilesetRows, spacing, margin, offsetX, offsetY, opacity }
    this.layers = [];
  }

  /** マップ全体のサイズをタイル数で設定 */
  setSize(cols, rows){
    this.cols = cols|0;
    this.rows = rows|0;
    this.width  = this.cols * this.tileWidth;
    this.height = this.rows * this.tileHeight;

    // 既存レイヤーのセルグリッドも再構成
    for (const L of this.layers){
      this._ensureGrid(L);
    }
    return this;
  }

  /** レイヤーを追加（上に重なる） */
  addLayer(name='layer', options={}){
    const L = {
      name,
      wrapper: document.createElement('div'),
      cells: [],
      data: null,
      visible: options.visible !== false,
      collidable: !!options.collidable,
      solidFn: null, // setCollision で設定
      tileset: null,
      tilesetURL: '',
      tilesetCols: 0,
      tilesetRows: 0,
      spacing: options.tileSpacing|0 || 0,
      margin:  options.tileMargin|0  || 0,
      offsetX: options.offsetX|0 || 0,
      offsetY: options.offsetY|0 || 0,
      opacity: (typeof options.opacity === 'number') ? options.opacity : 1
    };

    // wrapper の初期化
    const st = L.wrapper.style;
    L.wrapper.className = 'enchant-tilelayer';
    st.position = 'absolute';
    st.left = '0px'; st.top = '0px';
    st.width  = this.width + 'px';
    st.height = this.height + 'px';
    st.pointerEvents = 'none';  // ヒットはスプライト側で
    st.opacity = String(L.opacity);
    this._element.appendChild(L.wrapper);

    this.layers.push(L);

    if (options.tileset) this.setLayerTileset(this.layers.length-1, options.tileset);
    if (Array.isArray(options.data)) this.setLayerData(this.layers.length-1, options.data);

    this.setLayerVisible(this.layers.length-1, L.visible);
    if (L.offsetX || L.offsetY) this.setLayerOffset(this.layers.length-1, L.offsetX, L.offsetY);

    if (options.solid) this.setCollision(this.layers.length-1, options.solid);

    return L;
  }

  /** レイヤーを取得 */
  layerAt(index){ return this.layers[index] || null; }

  /** レイヤーの可視/不可視 */
  setLayerVisible(index, visible){
    const L = this.layers[index]; if (!L) return this;
    L.visible = !!visible;
    L.wrapper.style.display = L.visible ? '' : 'none';
    return this;
  }

  /** レイヤーの不透明度 */
  setLayerOpacity(index, opacity=1){
    const L = this.layers[index]; if (!L) return this;
    L.opacity = +opacity;
    L.wrapper.style.opacity = String(L.opacity);
    return this;
  }

  /** レイヤーのオフセット（パララックス等） */
  setLayerOffset(index, ox=0, oy=0){
    const L = this.layers[index]; if (!L) return this;
    L.offsetX = ox|0; L.offsetY = oy|0;
    L.wrapper.style.transform = `translate(${L.offsetX}px, ${L.offsetY}px)`;
    return this;
  }

  /** タイルセット画像の設定（レイヤー毎） */
  setLayerTileset(index, img){
    const L = this.layers[index]; if (!L) return this;

    const onready = ()=>{
      this._computeAtlas(L);
      this._ensureGrid(L);
      this._redrawLayer(L);
    };

    if (typeof img === 'string'){
      L.tilesetURL = img;
      L.tileset = new Image();
      L.tileset.onload = onready;
      L.tileset.src = img;
    } else if (img instanceof HTMLImageElement){
      L.tileset = img; L.tilesetURL = img.src; onready();
    } else if (img && img.src){
      L.tileset = img; L.tilesetURL = img.src; onready();
    }
    return this;
  }

  /** レイヤーデータ rows x cols を設定 */
  setLayerData(index, data){
    const L = this.layers[index]; if (!L) return this;
    // 初回にマップサイズ未指定なら data に合わせる
    const rows = data.length|0;
    const cols = (data[0]?.length|0) || 0;
    if (!this.cols || !this.rows) this.setSize(cols, rows);

    L.data = data;
    this._ensureGrid(L);
    this._redrawLayer(L);
    return this;
  }

  /** 1マスを書き換え */
  setTile(x, y, index, layerIndex=0){
    const L = this.layers[layerIndex]; if (!L || !L.data) return this;
    if (x<0||y<0||x>=this.cols||y>=this.rows) return this;
    L.data[y][x] = index|0;
    this._updateCell(L, x, y);
    return this;
  }

  /** タイル値を取得 */
  getTile(x, y, layerIndex=0){
    const L = this.layers[layerIndex]; if (!L || !L.data) return 0;
    if (x<0||y<0||x>=this.cols||y>=this.rows) return 0;
    return L.data[y][x]|0;
  }

  /** レイヤーの衝突ルールを設定 */
  setCollision(layerIndex, solid){
    const L = this.layers[layerIndex]; if (!L) return this;
    if (typeof solid === 'function'){
      L.solidFn = solid;
    } else {
      const set = new Set(Array.isArray(solid) ? solid : [solid]);
      L.solidFn = (idx)=> set.has(idx);
    }
    return this;
  }
  /** デフォルトの衝突判定：index > 0 を固体扱い */
  _isSolid(L, idx){ return L.solidFn ? !!L.solidFn(idx) : ((idx|0) > 0); }

  /** マップまたは指定レイヤーを再描画 */
  redraw(layerIndex=null){
    if (layerIndex == null){
      for (const L of this.layers) this._redrawLayer(L);
    } else {
      const L = this.layers[layerIndex]; if (L) this._redrawLayer(L);
    }
    return this;
  }

  // -----------------------------
  // 当たり判定（AABB vs タイル）
  // -----------------------------
  // 直近の親までの平行移動だけを合成して、即時の論理座標でAABBを取る
  _getGlobalPos(node){
    let x = 0, y = 0, n = node;
    while (n){
      if (typeof n._x === 'number') x += n._x;
      if (typeof n._y === 'number') y += n._y;
      if (!n.parentNode) break;
      n = n.parentNode;
    }
    return { x, y };
  }
  _getEntityAABB(entity){
    const p = this._getGlobalPos(entity);
    return { x: p.x, y: p.y, width: entity.width||0, height: entity.height||0 };
  }
  _getLayerOrigin(L){
    const pm = this._getGlobalPos(this);
    return { x: pm.x + (L.offsetX|0), y: pm.y + (L.offsetY|0) };
  }


    /**
   * collidable=true の全レイヤー、または opt.layers / opt.layer で指定したレイヤーに対してAABB判定
   * @param {Entity} entity
   * @param {object} opt { details?:boolean, layers?:number[] | number, layer?:number }
   */
    intersectEntity(entity, opt={}){
      let targets;
      // 単数 layer を layers に正規化
      if (typeof opt.layer === 'number') opt.layers = [opt.layer];
      if (Array.isArray(opt.layers) && opt.layers.length){
        targets = opt.layers
          .map(i => (i|0))
          .filter(i => i>=0 && i<this.layers.length)
          .map(i => ({ L:this.layers[i], idx:i }));
      } else {
        // デフォルト: collidable=true の全レイヤー
        targets = this.layers.map((L,idx)=>({L,idx})).filter(o => !!o.L.collidable);
      }
      if (!targets.length) return opt.details ? { hit:false, tiles:[] } : false;
  
      const erect = this._getEntityAABB(entity);
      const tw = this.tileWidth|0, th = this.tileHeight|0;
      let hit = false; const out = [];
  
      for (const {L, idx} of targets){
        if (!L || !L.data || !L.data.length) continue;
  
        const origin = this._getLayerOrigin(L);
        const left   = Math.floor((erect.x - origin.x) / tw);
        const right  = Math.floor((erect.x + erect.width  - origin.x - 1) / tw);
        const top    = Math.floor((erect.y - origin.y) / th);
        const bottom = Math.floor((erect.y + erect.height - origin.y - 1) / th);
  
        for (let ty=top; ty<=bottom; ty++){
          if (ty<0 || ty>=this.rows) continue;
          for (let tx=left; tx<=right; tx++){
            if (tx<0 || tx>=this.cols) continue;
            const t = (L.data[ty]?.[tx])|0;
            const solid = L.solidFn ? !!L.solidFn(t) : (t>0); // 既定: >0 は固体
            if (solid){
              hit = true;
              if (opt.details) out.push({ layer: idx, x: tx, y: ty, index: t });
            }
          }
        }
      }
      return opt.details ? { hit, tiles: out } : hit;
    }
  


  // =============================
  // 内部実装
  // =============================

  _computeAtlas(L){
    const img = L.tileset;
    const W = img?.naturalWidth  || 0;
    const H = img?.naturalHeight || 0;
    const tw = this.tileWidth, th = this.tileHeight, sp = L.spacing, mg = L.margin;
    if (!tw || !th || !W || !H){ L.tilesetCols = L.tilesetRows = 0; return; }
    L.tilesetCols = Math.max(1, Math.floor((W - mg + sp) / (tw + sp)));
    L.tilesetRows = Math.max(1, Math.floor((H - mg + sp) / (th + sp)));
  }

  _ensureGrid(L){
    // wrapperサイズはマップに追随
    const stw = L.wrapper.style;
    stw.width  = this.width  + 'px';
    stw.height = this.height + 'px';

    const need = this.cols * this.rows;

    // セル数調整
    while (L.cells.length > need){
      const c = L.cells.pop();
      if (c.parentNode) c.parentNode.removeChild(c);
    }
    while (L.cells.length < need){
      const cell = document.createElement('div');
      cell.className = 'enchant-tilecell';
      const st = cell.style;
      st.position='absolute';
      st.width = this.tileWidth+'px';
      st.height= this.tileHeight+'px';
      st.backgroundRepeat='no-repeat';
      st.imageRendering='pixelated';
      L.wrapper.appendChild(cell);
      L.cells.push(cell);
    }

    // 全セルの位置決め
    for (let y=0; y<this.rows; y++){
      for (let x=0; x<this.cols; x++){
        const i = y*this.cols + x;
        const st = L.cells[i].style;
        st.left = (x*this.tileWidth)+'px';
        st.top  = (y*this.tileHeight)+'px';
      }
    }
  }

  _tileToBackground(L, index){
    if (!L.tileset || !L.tilesetCols) return null;
    const idx = (index|0) - 1; if (idx < 0) return null; // 0/-1 -> 空
    const tw=this.tileWidth, th=this.tileHeight, sp=L.spacing, mg=L.margin;
    const cols = L.tilesetCols;
    const ix = idx % cols;
    const iy = Math.floor(idx / cols);
    const x = mg + ix * (tw + sp);
    const y = mg + iy * (th + sp);
    return { bg: `url("${L.tilesetURL}")`, pos: `-${x}px -${y}px` };
  }

  _updateCell(L, x, y){
    const i = y*this.cols + x;
    const cell = L.cells[i]; if (!cell) return;
    const st = cell.style;

    const index = L.data ? (L.data[y]?.[x]|0) : 0;
    const conf = this._tileToBackground(L, index);
    if (!conf){ st.backgroundImage=''; st.display='none'; }
    else { st.display=''; st.backgroundImage=conf.bg; st.backgroundPosition=conf.pos; }
  }

  _redrawLayer(L){
    if (!L.data || !L.data.length) return;
    for (let y=0; y<this.rows; y++){
      for (let x=0; x<this.cols; x++){
        this._updateCell(L, x, y);
      }
    }
  }
}

// よく使う Label スタイル
Label.styles = {
  title: {
    fontSize: 28,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    fontWeight: '700',
    color: '#fff',
    textShadow: '0 2px 6px rgba(0,0,0,.6)'
  },
  outline: {
    fontSize: 20,
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '700',
    color: '#fff',
    // setStroke を別途呼ぶとより太くできる
    textShadow: [
      '1px 0 0 #000', '-1px 0 0 #000', '0 1px 0 #000', '0 -1px 0 #000',
      '1px 1px 0 #000', '-1px -1px 0 #000', '-1px 1px 0 #000', '1px -1px 0 #000'
    ].join(', ')
  },
  glow: {
    fontSize: 20,
    fontFamily: 'system-ui, sans-serif',
    color: '#8ef',
    textShadow: '0 0 6px #4df, 0 0 12px #4df'
  },
  ui: {
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    color: '#222',
    backgroundColor: 'rgba(255,255,255,.8)'
  }
};

// ---------- Google Fonts loader ----------
export function loadGoogleFont(
  family,
  { weights=[400], italic=false, display='swap', sampleText='漢かなカナ_日本語Sample123' }={}
){
  const famText=family.trim(); const famUrl=encodeURIComponent(famText);
  let axis;
  if(typeof weights==='string'){ axis = italic?`ital,wght@0,${weights}`:`wght@${weights}`; }
  else{ const ws=[...new Set(weights.map(w=>parseInt(w,10)||400))].sort((a,b)=>a-b); axis = italic?`ital,wght@0,${ws.join(';0,')}`:`wght@${ws.join(';')}`; }
  const id=`gf-${famUrl}-${axis}`; if(!document.getElementById(id)){ const link=document.createElement('link'); link.id=id; link.rel='stylesheet'; link.href=`https://fonts.googleapis.com/css2?family=${famUrl}:${axis}&display=${display}`; document.head.appendChild(link); }
  const waitReady=async()=>{ if(!document.fonts||!document.fonts.load) return;
    const probeW=Array.isArray(weights)?(weights[0]||400):400;
    try{
      await document.fonts.load(`normal ${probeW} 1em "${famText}"`, sampleText);
      await document.fonts.load(`normal ${probeW} 1em "${famText}"`, sampleText);
    }catch(_){}
  };
  return Promise.race([waitReady(), new Promise(r=>setTimeout(r,1500))]);
}


// Default export (optional)
// Define touchEnabled accessor if not present
if (!Object.getOwnPropertyDescriptor(Node.prototype,'touchEnabled')){
  Object.defineProperty(Node.prototype,'touchEnabled',{
    get(){ return this._touchEnabled; },
    set(v){ this._touchEnabled = !!v; this._element.style.pointerEvents = this._touchEnabled ? 'auto' : 'none'; }
  });
}
// export { Easing };
export default { Core, Scene, Group, Entity, Sprite, Label, Splite, Game, Event, TileMap, Rect, Circle, loadGoogleFont };

// =============================
// Minimal style to make DOM nodes visible (optional; consumer may override)
// Inject once when module loads
(function ensureStyle(){
  if (document.getElementById('enchant-dom-style')) return;
  const style = document.createElement('style');
  style.id = 'enchant-dom-style';
  style.textContent = `
  .enchant-stage { position: relative; overflow: hidden; }
  .enchant-node { position: absolute; }
  .enchant-entity { box-sizing: border-box; }
  .enchant-scene { position:absolute; left:0; top:0; width:100%; height:100%; }
  .enchant-label { white-space: pre; display:inline-block; }
  .enchant-frame-overlay { pointer-events: none; }

  `;
  document.head.appendChild(style);
})();
