# Managic DOM Engine & UI Toolkit

## 概要
- `managic_dom.js` は enchant.js ライクな API を DOM/CSS ベースで再実装した軽量ゲームエンジンです。Canvas を使わずに `<div>`/`<img>` をレイヤリングし、主要クラス（`Core`/`Scene`/`Group`/`Sprite`/`Label` など）を ES Modules として提供します。
- `managic_ui.js` は学習・教育向けゲームを想定した UI コンポーネント群で、`managic_dom.js` のクラスを継承しつつウィンドウ、ボタン、立ち絵、ゲージ、演出カバーなどを簡単に組み込めるようにします。

## クイックスタート
```js
import { Core, Scene, Sprite, Label } from './managic_dom.js';
import { FrameWindow, UIButton } from './managic_ui.js';

const core = new Core(320, 480);
core.preload(['./assets/player.png']);

core.addEventListener('load', () => {
  const scene = core.rootScene;

  const player = new Sprite(32, 32);
  player.image = core.assets['./assets/player.png'];
  scene.addChild(player);

  const ui = new FrameWindow(220, 120, 'panel');
  ui.x = 20; ui.y = 320;
  const button = new UIButton(180, 36, { text: 'スタート' });
  button.on('click', () => console.log('clicked'));
  ui.content.addChild(button);
  scene.addChild(ui);
});

core.start();
```

---

## `managic_dom.js` リファレンス

### イベントシステム
#### `Event`
- `new Event(type)` で生成。`type`, `target`, `x`, `y`, `localX`, `localY`, `elapsed` を保持。
- 主な定数:
  - ライフサイクル: `LOAD`, `ERROR`, `CORE_RESIZE`, `PROGRESS`。
  - フレーム: `ENTER_FRAME`, `EXIT_FRAME`, `ENTER`, `EXIT`, `RENDER`。
  - シーン/ノード: `CHILD_ADDED`, `ADDED`, `ADDED_TO_SCENE`, `CHILD_REMOVED`, `REMOVED`, `REMOVED_FROM_SCENE`。
  - ポインタ: `TOUCH_START`, `TOUCH_MOVE`, `TOUCH_END`。
  - 入力: `INPUT_START`, `INPUT_CHANGE`, `INPUT_END` と方向/AB ボタンの押下イベント。

#### `EventTarget`
- `addEventListener(type, fn)` / `removeEventListener` / `clearEventListener` / `dispatchEvent` / `on` を持つ基底クラス。

### ノード階層
#### `Node extends EventTarget`
- プロパティ: `x`, `y`, `width`, `height`, `rotation`, `scaleX`, `scaleY`, `opacity`, `visible`, `touchEnabled`, `parentNode`, `scene`, `childNodes`, `age`。
- メソッド: `moveTo`, `moveBy`, `addChild(node)`, `removeChild(node)`, `remove()`。
- 内部 `_element` は DOM ノード。`_update()` が transform/visibility を反映。

#### `Group extends Node`
- 子ノードのコンテナ。追加の API はなく DOM クラス名のみ付与。

#### `Entity extends Node`
- 背景色 (`backgroundColor`) を持ち、AABB 取得・当たり判定ヘルパを提供。
- 幾何メソッド: `getLogicalRect()`, `getBoundingRect()`, `intersect(other)`, `within(other, distance)`, `hitTest(x,y)`。
- `Entity.intersectAABB(a, b)` で静的判定も可能。

#### `Label extends Entity`
- テキスト描画用ノード。`text`, `color`, `font`, `fontSize`, `fontFamily`, `fontWeight`, `textAlign`, `lineHeight`, `letterSpacing`, `textShadow` などをサポート。
- `fitToTextWidth` を `true` にすると文字幅にボックスを合わせる。
- `setStroke(width, color, mode)` で縁取り、`measureTextSize()` と `textWidth`、`useGoogleFont(family, opts)`、`useFontPreset(name, overrides)`（非同期）、`applyStyle(name)`（`Label.styles` プリセット）を利用可能。
- Font preset helpers: `Label.registerFontPreset(name, config)`, `Label.getFontPreset(name)`, `Label.listFontPresets(includeAliases)`, `Label.resolveFontPresetOptions(name, overrides, fontSize)`。Built-ins: `zenKakuGothicNew`, `delaGothicOne`, `nicoMoji`, `zenMaruGothic`, `shipporiMincho`, `hachiMaruPop`, `rampartOne`, `dotGothic16`, `pottaOne`。

#### `Sprite extends Entity`
- 画像またはスプライトシート表示。`image` に URL/`HTMLImageElement`/`core.assets` をセット。
- `frame`（数値 or `[x,y]`）、`frames`（配列）を使って表示セルを切り替え。
- `animate(frames, interval, { loop, pingpong, startIndex })` / `stopAnimation()` で自動再生。

#### `Shape extends Entity`
- CSS ベースの図形。`fillColor`, `strokeColor`, `strokeWidth`, `cornerRadius` を設定可能。

#### `Rect extends Shape`
- `new Rect(width, height, { fillColor, strokeColor, strokeWidth, cornerRadius })`。

#### `Circle extends Shape`
- `new Circle(diameter, options)`。CSS の `border-radius:50%` を適用。

### シーンとゲームループ
#### `Scene extends Group`
- `backgroundColor` を持つ。`Core` によってステージへ積み重ねられる。

#### `Core extends EventTarget`（`Game` エイリアス）
- コンストラクタ: `new Core(width=320, height=320)`。
- ステージ管理: `pushScene(scene)`, `popScene()`, `replaceScene(scene)`, `removeScene(scene)`。
- ループ制御: `fps`, `frame`, `running`, `start()`, `stop()`, `pause()`, `resume()`。
- アセット: `preload(...paths)`, `loadAssets(list, { emitProgress })`, `ensureAssets(list)`, `prefetch`, `getAsset(path)`, `hasAsset(path)`, `unloadAssets(paths)`。
- 入力: `keybind(keyCode, name)`, `keyunbind(keyCode)`, `changeButtonState(button, bool)`。
- ポインタイベントは DOM ヒットを元に自動で `TOUCH_*` をディスパッチ。
- サイズ: `width`, `height`, `scale` の setter で舞台を再レイアウト、`Event.CORE_RESIZE` を発火。
- `Core.instance` としてシングルトン参照を保持。

#### `TileMap extends Entity`
- DOM ベースのタイルマップ。複数レイヤー、タイルセット、衝突判定に対応。
- サイズ: `setSize(cols, rows)`。
- レイヤー: `addLayer(name, options)`, `layerAt(index)`, `setLayerVisible(index, visible)`, `setLayerOpacity(index, opacity)`, `setLayerOffset(index, ox, oy)`。
- タイルセット: `setLayerTileset(index, imageOrUrl)`, `setLayerData(index, data)`、個別更新 `setTile(x,y,index, layer)` / `getTile`。
- 衝突: `setCollision(layerIndex, solidFn|indices)`、`intersectEntity(entity, { layer|layers, details })` でAABB対タイルの判定。
- `redraw(layerIndex)` で描画を再生成。

### タイムラインとユーティリティ
- すべてのノードは `tl` プロパティを通じて簡易タイムラインを利用できます。
  - 主なメソッド: `clear()`, `loop()`, `unloop()`, `and()`, `delay(frames)`, `then(fn)`, `moveTo(x,y,frames,easing)`, `moveBy(dx,dy,frames,easing)`, `scaleTo(sx,sy,frames,easing)`, `rotateTo(deg,frames,easing)`, `fadeTo(opacity,frames,easing)`。
- `loadGoogleFont(family, { weights, italic, display, sampleText })` で Google Fonts を動的読み込み。
- エイリアス: `Game`（`Core`）、`Splite`（`Sprite`）。`default` エクスポートは主要クラスをまとめたオブジェクト。

---

## `managic_ui.js` リファレンス

### 概要
- `managic_dom.js` のクラスをベースに、教育向け UI をすぐ利用できるようまとめたコンポーネント集です。すべて ES Module で提供され、個別 import が可能です。

### クラス一覧

#### `FrameWindow extends Group`
- ウィンドウ風のパネルコンテナ。`content`（`Group`）へ子要素を追加。
- `new FrameWindow(width=200, height=120, preset='panel')`。
- `padding`（数値または `{ top,right,bottom,left }`）、`setSize(w,h)`、`usePreset(name, overrides)`。
- プリセット: `panel`, `dark`, `glass`, `accent`。`overrides` で CSS 値を上書き可能。
- サンプルコード:
  ```js
  import { FrameWindow, UIButton } from './managic_ui.js';

  const windowUI = new FrameWindow(240, 140, 'glass');
  windowUI.padding = { top: 16, left: 16, right: 16, bottom: 12 };

  const okButton = new UIButton(180, 40, { text: 'OK' });
  okButton.on('click', () => console.log('ok clicked'));

  windowUI.content.addChild(okButton);
  core.currentScene.addChild(windowUI);
  ```

#### `UIButton extends Group`
- 画像・CSS どちらにも対応したボタン。
- オプション: `{ text, image, autoFitText=true, minFontSize, maxFontSize, paddingX, paddingY, frames, themes }`。
- メソッド: `setSize(w,h)`, `setText(text)`, `setEnabled(bool)`, `setFrames(map)`, `setThemes(map)`。
- 状態: `normal`, `hover`, `active`, `disabled`。`Event.TOUCH_*` と `'click'` イベントをディスパッチ。
- サンプルコード:
  ```js
  import { UIButton } from './managic_ui.js';

  const startButton = new UIButton(160, 48, { text: 'スタート', autoFitText: true });
  startButton.on('click', () => core.replaceScene(createGameScene(core)));
  startButton.setEnabled(true);

  scene.addChild(startButton);
  ```

#### `LabelArea extends Entity`
- 複数行テキスト・タイプライタ演出・簡易禁則処理付きテキストボックス。
- オプション: `{ text, speed, font, fontSize, color, lineHeight }`。
- メソッド: `setText(raw)`, `play()`, `pause()`, `resetTyping()`, `skipAll()`。
- 非同期: `useFontPreset(name, overrides)` で Label と同じプリセット指定が可能。
- プロパティ: `text`, `speed`, `font`, `fontSize`, `lineHeight`, `color`。`[b]...[/b]`, `[u]...[/u]`, `\n` に対応。
- サンプルコード:
  ```js
  import { LabelArea } from './managic_ui.js';

  const dialogue = new LabelArea(260, 100, { speed: 3, font: '16px system-ui' });
  dialogue.setText('[b]勇者[/b]: ここから先は危険だ。\n[u]準備はいいか？[/u]');
  dialogue.play();

  windowUI.content.addChild(dialogue);
  ```

#### `FrameOverlay extends Group`
- ステージ最前面に被せる装飾フレーム。Core サイズにフィット。
- `new FrameOverlay(preset='simple', opts={})`。
- メソッド: `fitToCore()`, `usePreset(name, opts)`, `useImageFrame(url, slice, repeat)`, `bringToFront()`, `addPart(node)`。
- プリセット: `simple`, `arcade`, `bezel`, `rounded`, `shadow-only`。
- サンプルコード:
  ```js
  import { FrameOverlay } from './managic_ui.js';
  import { Label } from './managic_dom.js';

  const overlay = new FrameOverlay('arcade');
  overlay.useImageFrame('./assets/ui/frame.png', 24, 'stretch');
  overlay.addPart(new Label('SCORE')); // 位置は個別に設定
  overlay.bringToFront();

  core.currentScene.addChild(overlay);
  ```

#### `CharSprite extends Group`
- JRPG 風の立ち絵表示。差分画像の切り替えと演出をまとめて提供。
- コンストラクタ: `new CharSprite(name, { baseDir='./assets/chara', width, height, defaultDiff='default', fit=true })`。
- メソッド: `setSize(w,h)`, `setDiff(diffName)`, `listDiffsFromAssets()`, `showEmotion(what, opts)`, `hideEmotion()`。
- 演出ヘルパ: `animFadeIn`, `animFadeOut`, `animAttack`, `animDamaged`, `animShake`, `animSlideInLeft`, `animSlideOutRight`, `animSlideInBottom`, `animSlideInTop`, `animSlideOutBottom`, `animSlideOutTop`。
- `showEmotion` は絵文字/テキスト/画像/任意ノードを配置し、`pop` や `bounce` などのアニメ付き。
- サンプルコード:
  ```js
  import { CharSprite } from './managic_ui.js';

  const hero = new CharSprite('hero', { baseDir: './assets/chara', width: 320, height: 360 });
  hero.setDiff('smile');
  hero.animFadeIn(20);
  hero.showEmotion('💡', { anim: 'pop' });

  scene.addChild(hero);
  ```

#### `StatusBar extends Group`
- ゲージ or トークン式のステータス表示。
- コンストラクタ: `new StatusBar(type='gauge', options)`。
  - 共通オプション: `{ width, height, x, y, label, labelAlign, font, color, max, value, animateFrames }`。
  - ゲージ用: `{ bgColor, barColor, border, radius, padding, showValue }`。
  - トークン用: `{ symbolFilled, symbolEmpty, tokenSize, spacing, perRow }`。
- メソッド: `setMax(max)`, `setValue(value, animate=true)`, `addValue(delta, animate)`, `setLabel(text)`, `setColors({ bgColor, barColor })`。
- サンプルコード:
  ```js
  import { StatusBar } from './managic_ui.js';

  const hpBar = new StatusBar('gauge', { width: 220, label: 'HP', max: 100, value: 80 });
  hpBar.x = 20; hpBar.y = 420;
  hpBar.setValue(65, true); // アニメしながら減少

  scene.addChild(hpBar);
  ```

#### `AnimatedCover extends Entity`
- 画面全体または任意ノードを覆い、フラッシュ/暗転などの演出を再生。
- コンストラクタ: `new AnimatedCover(width?, height?, { color, blendMode, zIndex, autoMount=true })`。
- メソッド: `fitToScene()`, `fitToNode(node, pad)`, `setColor(color)`, `bringToFront()`, `play(type, options)`。
- 演出タイプ: `hit`, `attack`, `darken`, `lighten`, `blink`, `fadein`, `fadeout`（`frames`, `peak`, `keep`, `times`, `autoRemove` など指定可）。
- スタティックヘルパ: `AnimatedCover.play(type, opts)`（シーン全体）、`AnimatedCover.playOnNode(node, type, opts)`（対象ノード範囲）。
- サンプルコード:
  ```js
  import { AnimatedCover } from './managic_ui.js';

  // 画面全体を赤くフラッシュ
  AnimatedCover.play('hit', { peak: 0.8, frames: 10 });

  // プレイヤースプライトだけを暗転
  AnimatedCover.playOnNode(playerSprite, 'darken', { to: 0.9, frames: 20, pad: 6 });
  ```

#### `Particle extends Group`
- 1 粒子の挙動（寿命・重力・スプライト/図形表示）を管理。
- オプション: `{ x, y, vx, vy, ax, ay, gravity, life, scaleFrom, scaleTo, opacityFrom, opacityTo, rotationFrom, rotationTo, type, image, fw, fh, frames, fps, shape, size, color, border, shadow, className }`。
- 自動で `Event.ENTER_FRAME` により物理更新し、寿命で `remove()`。
- スタティックヘルパ: `Particle.burst(parent, x, y, opts)` で放射状に複数生成。`opts` で `count`, `speedMin`, `speedMax`, `spread`, `gravity`, `type`, `css`, `sprite` を指定。
- サンプルコード:
  ```js
  import { Particle } from './managic_ui.js';
  import { Event } from './managic_dom.js';

  scene.on(Event.TOUCH_END, (e) => {
    Particle.burst(scene, e.x, e.y, {
      type: 'css',
      count: 18,
      css: { color: '#ffcc00', size: 10 },
      gravity: 0.3
    });
  });
  ```

#### `MenuScene extends Scene`
- Single-step selection scene. Requires `key` and `onComplete`; because it extends `Scene`, you can swap it in with `core.replaceScene(new MenuScene(opts))`.
- Constructor: `new MenuScene({ key, title?, description?, uiPreset?, theme?, frameOverlay?, overlayPreset?, overlayOptions?, framePadding?, selectorType?, options?, range?, deps?, statusbar?, assets?, onComplete, onCancel?, debounceMs?, reuseOverlay?, colors? })`.
- `uiPreset` selects a ready-made palette (`'default'`, `'warm'`, `'forest'`). Use `colors` to override pieces (`backgroundColor`, `buttonThemes`, `statusbarDefaults`, `noteColor`, etc.).
- If `frameOverlay` is omitted the scene tries to reuse a `FrameOverlay` from the previous scene; otherwise it instantiates one based on `overlayPreset`/`overlayOptions`. Pass `reuseOverlay:false` to force creation of a new overlay.
- `selectorType` can be `list` (default), `grid`, or `counter`. List/grid confirm immediately on tap. Counter uses `range`({ min, max, step, default, unitLabel }) with `-`/`+` buttons and a dedicated confirm button.
- `options` entries accept `{ value, label, icon, disabled, note }`. Disabled items are non-interactive; icons are auto-laid out.
- `statusbar` renders a `StatusBar` in the header; presets follow the palette, and `{ type: 'gauge'|'token', progress, label, ... }` overrides are merged.
- `assets` lists extra resources that should be loaded via `Core.ensureAssets` before the UI appears. Failures downgrade gracefully.
- On completion the scene calls `onComplete({ key, value, meta })`; `meta` may include `label`, `note`, `icon`, `unit`, `deps` and more. `debounceMs` (default 300ms) locks every button to avoid double taps; errors in callbacks show a toast-like message and unlock the UI.
- When there are no options the scene displays “選択肢がありません” and only the back button (when `onCancel` is provided) stays enabled.
- Example:
  ```js
  import { Core, Scene, Event } from './managic_dom.js';
  import { MenuScene, FrameOverlay } from './managic_ui.js';

  const core = new Core(768, 576);
  const result = {};
  let sharedOverlay = null;

  const getUnits = (subject) => [
    { id: 'fractions', name: '分数', summary: '割り算を使う単元' },
    { id: 'geometry', name: '図形', summary: '角度と面積を学ぼう' }
  ];

  function createTitleScene(){
    const scene = new Scene();
    scene.backgroundColor = '#666';
    const overlay = new FrameOverlay('arcade');
    sharedOverlay = overlay;
    scene.addChild(overlay);
    scene.on(Event.ENTER, () => {
      if (sharedOverlay && sharedOverlay.parentNode !== scene) scene.addChild(sharedOverlay);
      if (sharedOverlay && typeof sharedOverlay.fitToCore === 'function') sharedOverlay.fitToCore();
    });
    scene.on(Event.TOUCH_END, () => showSubject());
    return scene;
  }

  function showSubject(){
    core.replaceScene(new MenuScene({
      key: 'subject',
      title: '教科をえらぼう',
      description: 'あそびたい勉強をひとつえらんでね。',
      uiPreset: 'forest',
      frameOverlay: sharedOverlay,
      selectorType: 'grid',
      statusbar: { type: 'gauge', progress: 0.33, label: '1 / 3' },
      options: [
        { value: 'jp', label: '国語' },
        { value: 'math', label: '算数' },
        { value: 'sci', label: '理科' },
        { value: 'soc', label: '社会', note: '地理や歴史など' }
      ],
      onComplete: ({ key, value }) => { result[key] = value; showUnit(); },
      onCancel: () => { core.replaceScene(createTitleScene()); }
    }));
  }

  function showUnit(){
    core.replaceScene(new MenuScene({
      key: 'unit',
      title: '単元をえらぼう',
      uiPreset: 'forest',
      frameOverlay: sharedOverlay,
      selectorType: 'list',
      statusbar: { type: 'gauge', progress: 0.66, label: '2 / 3' },
      deps: { subject: result.subject },
      options: getUnits(result.subject).map(u => ({ value: u.id, label: u.name, note: u.summary })),
      onComplete: ({ key, value }) => { result[key] = value; showQuestionCount(); },
      onCancel: showSubject
    }));
  }

  function showQuestionCount(){
    core.replaceScene(new MenuScene({
      key: 'count',
      title: '問題のかず',
      description: 'チャレンジする問題数をきめよう。',
      uiPreset: 'forest',
      frameOverlay: sharedOverlay,
      selectorType: 'counter',
      range: { min: 5, max: 30, step: 5, default: 10, unitLabel: '問' },
      onComplete: ({ key, value }) => {
        result[key] = value;
        console.log('選択結果', result);
        // 次のシーンへ差し替え…
      },
      onCancel: showUnit
    }));
  }
  ```


#### `LoadingScene extends Scene`
- `Core.ensureAssets` を用いた追加読み込み用シーン。プログレスバー付き。
- オプション: `{ files, next, label, barWidth, barHeight, barColor, barBgColor, barRadius }`。
- 自動で `Event.PROGRESS` を受け取りバーを更新し、読み込み完了で `next` に遷移（関数/シーンインスタンス/グローバル関数名）。
- サンプルコード:
  ```js
  import { LoadingScene } from './managic_ui.js';

  const loading = new LoadingScene({
    files: ['./assets/bgm.mp3', './assets/chara/char_hero_default.png'],
    next: (core) => createTitleScene(core),
    label: 'Now Loading...'
  });

  core.pushScene(loading);
  ```

---

## 補足
- どちらのモジュールも追加ライブラリへ依存せずブラウザのみで動作します。
- `managic_dom.js` は Canvas を使わないため、CSS でのテーマ変更やアクセシビリティ調整がしやすい半面、大量のスプライトを扱う際は DOM の制限を考慮してください。
- 教材シナリオでは `Core` の `rootScene` にゲームロジック、本番前に `LoadingScene` でアセットを揃え、`FrameWindow` や `StatusBar` で UI を合成する構成が推奨です。
