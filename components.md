managic_dom.jsおよびmanagic_ui.jsのコンポーネントの簡易なリファレンス

# managic_dom.jsのコンポーネント

## 各ノードの継承関係

EventTarget（各種イベントのlisten,dispatch,onを持つ基底クラス）
    Core（シーン、ループ、アセット、入力などを扱うゲーム本体）
    Node（位置、サイズ、表示、非表示、タイムライン、addChild、removeChildなどを扱う基本ノード）
        Group（複数の子ノードを管理するコンテナ）
            Scene（表示階層を管理するシーン）
        Entity（背景色と当たり判定を持つ基本ノード）
            Label（テキスト表示用ノード）
            Sprite（画像表示用ノード）
            Shape（円や四角などの基本図形）
                Rect（四角）
                Circle（円）
            TileMap（タイルマップ）

# managic_ui.jsのコンポーネント

## コンポーネント一覧

- UIButton
- LabelArea
- FrameWindow
- FrameOverlay
- CharSprite
- StatusBar
- AnimatedCover
- Particle
- LoadingScene
- MenuScene

## UIButton（画像・CSS どちらにも対応したボタン）
```js
import { UIButton } from './managic_ui.js';
const startButton = new UIButton(160, 48, { text: 'スタート', autoFitText: true });
startButton.ontouchend = () => console.log('touchend');
```

## LabelArea（複数行テキスト・タイプライタ演出・簡易禁則処理付きテキストボックス）

## FrameWindow（ウィンドウ風のパネルコンテナ）
    主な子ノード：
    UIButton（ボタン）
    

## FrameOverlay（ステージ最前面に被せる装飾フレーム）

## CharSprite（キャラクター表示用ノード。差分画像の切り替えと演出をまとめて提供。）

## StatusBar（ゲージ or トークン式のステータス表示。）

## AnimatedCover（選択受付時の演出など。画面全体または任意ノードを覆い、フラッシュ/暗転などの演出を再生。）
```js
  import { AnimatedCover } from './managic_ui.js';

  // 画面全体を赤くフラッシュ
  AnimatedCover.play('hit', { peak: 0.8, frames: 10 });

  // プレイヤースプライトだけを暗転
  AnimatedCover.playOnNode(playerSprite, 'darken', { to: 0.9, frames: 20, pad: 6 });
```

## Particle（粒子エフェクト。放射状に複数生成。）
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

## LoadingScene（アセットの追加読み込み用シーン。プログレスバー付き。次のシーンへ進むのに追加のロードが必要な時用）
```js
import { LoadingScene } from './managic_ui.js';

const loading = new LoadingScene({
  files: ['./assets/bgm.mp3', './assets/chara/char_hero_default.png'],
  next: (core) => createTitleScene(core),
  label: 'Now Loading...'
});

core.pushScene(loading);
```

## MenuScene（単一ステップ選択シーン。）
```js
import { MenuScene } from './managic_ui.js';

const menu = new MenuScene({
  key: 'genre',
  title: 'ジャンル',
  description: 'プレイするジャンルを選択しよう。',
  uiPreset: 'default',
  frameOverlay: sharedOverlay,
  selectorType: 'list',
  options: [
    { value: 'math', label: '数学', icon: 'math' },
    { value: 'reading', label: '読解', icon: 'reading' },
    { value: 'writing', label: '作文', icon: 'writing' }
  ],
  onComplete: ({ key, value }) => {
    result[key] = value;
    console.log('選択結果', result);
    // 次のシーンへ差し替え…
  },
  onCancel: showGenre
});

core.pushScene(menu);
```