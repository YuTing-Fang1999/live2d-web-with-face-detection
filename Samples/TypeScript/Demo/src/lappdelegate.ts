/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismFramework, Option } from '@framework/live2dcubismframework';

import * as LAppDefine from './lappdefine';
import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppPal } from './lapppal';
import { LAppTextureManager } from './lapptexturemanager';
import { LAppView } from './lappview';
import { Expression } from './lapplive2dmanager';
export let canvas_gl: HTMLCanvasElement = null;
export let canvas_2d: HTMLCanvasElement = null;
export let ctx: CanvasRenderingContext2D = null;
export let s_instance: LAppDelegate = null;
export let gl: WebGLRenderingContext = null;
export let frameBuffer: WebGLFramebuffer = null;

/**
 * アプリケーションクラス。
 * Cubism SDKの管理を行う。
 */
export class LAppDelegate {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  /**
   * APPに必要な物を初期化する。
   */
  public initialize(): boolean {
    // キャンバスの作成
    canvas_gl = document.createElement('canvas');
    canvas_2d = document.createElement('canvas');
    if (LAppDefine.CanvasSize === 'auto') {
      this._resizeCanvas();
    } else {
      canvas_gl.width = LAppDefine.CanvasSize.width;
      canvas_gl.height = LAppDefine.CanvasSize.height;
    }

    canvas_2d.width = 1900; // 300
    canvas_2d.height = 698; // 200
    ctx = canvas_2d.getContext("2d");


    // glコンテキストを初期化
    // @ts-ignore
    gl = canvas_gl.getContext('webgl') || canvas_gl.getContext('experimental-webgl');

    if (!gl) {
      alert('Cannot initialize WebGL. This browser does not support.');
      gl = null;

      document.body.innerHTML =
        'This browser does not support the <code>&lt;canvas&gt;</code> element.';

      // gl初期化失敗
      return false;
    }

    // キャンバスを DOM に追加
    // document.body.appendChild(canvas_gl);
    document.body.appendChild(canvas_2d);
    if (!frameBuffer) {
      frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    }

    // 透過設定
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const supportTouch: boolean = 'ontouchend' in canvas_gl;

    if (supportTouch) {
      // タッチ関連コールバック関数登録
      canvas_gl.ontouchstart = onTouchBegan;
      canvas_gl.ontouchmove = onTouchMoved;
      canvas_gl.ontouchend = onTouchEnded;
      canvas_gl.ontouchcancel = onTouchCancel;

      canvas_2d.ontouchstart = onTouchBegan;
      canvas_2d.ontouchmove = onTouchMoved;
      canvas_2d.ontouchend = onTouchEnded;
      canvas_2d.ontouchcancel = onTouchCancel;

    } else {
      // マウス関連コールバック関数登録
      canvas_gl.onmousedown = onClickBegan;
      canvas_gl.onmousemove = onMouseMoved;
      canvas_gl.onmouseup = onClickEnded;

      canvas_2d.onmousedown = onClickBegan;
      canvas_2d.onmousemove = onMouseMoved;
      canvas_2d.onmouseup = onClickEnded;
    }

    // AppViewの初期化
    this._view.initialize();
    this._view._viewMatrix.adjustTranslate(0, -0.52);

    // Cubism SDKの初期化
    this.initializeCubism();

    return true;
  }

  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    this._resizeCanvas();
    this._view.initialize();
    this._view.initializeSprite();
  }

  /**
   * 解放する。
   */
  public release(): void {
    this._textureManager.release();
    this._textureManager = null;

    this._view.release();
    this._view = null;

    // リソースを解放
    LAppLive2DManager.releaseInstance();

    // Cubism SDKの解放
    CubismFramework.dispose();
  }

  /**
   * 実行処理。
   */
  public run(): void {
    // メインループ
    const loop = (): void => {
      // インスタンスの有無の確認
      if (s_instance == null) {
        return;
      }

      // 時間更新
      LAppPal.updateTime();

      // 画面の初期化
      gl.clearColor(0.0, 0.0, 0.0, 1.0);

      // 深度テストを有効化
      gl.enable(gl.DEPTH_TEST);

      // 近くにある物体は、遠くにある物体を覆い隠す
      gl.depthFunc(gl.LEQUAL);

      // カラーバッファや深度バッファをクリアする
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.clearDepth(1.0);

      // 透過設定
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // 描画更新
      // this._view.render();


      if (!this._view.transforming) {
        this._view.next_state = this._view.socket_state;
      }

      var state = this._view.state;
      var next_state = this._view.next_state;
      var cur_config = this._view.cur_config;
      // console.log(state, next_state);
      if (state != next_state) {

        this._view.transforming = true;
        const prev_config = this._view.configs[state];
        const next_config = this._view.configs[next_state];

        var Duration = this._view.tfmDuration;
        var diff = {};

        for (const [key, val] of Object.entries(prev_config))
          diff[key] = (next_config[key] - prev_config[key]) / Duration;

        for (const [key, val] of Object.entries(diff)) {

          cur_config[key] = cur_config[key] + diff[key];
          if (diff[key] > 0) cur_config[key] = Math.min(cur_config[key], next_config[key]);
          if (diff[key] < 0) cur_config[key] = Math.max(cur_config[key], next_config[key]);


        }

        var change = false;

        for (const [key, val] of Object.entries(cur_config)) {
          if (Math.round(cur_config[key] * 10000 - next_config[key] * 10000) != 0) change = true;
        }

        if (!change) {
          console.log("transformation done.");
          this._view.state = next_state;
          this._view.transforming = false;
          LAppLive2DManager.getInstance().changeStyle(this._view.state);
          // LAppLive2DManager.getInstance().getModel(0)._exp = Expression.None;
        }
        else console.log("transformation not done.");
        // console.log(LAppLive2DManager.getInstance().getModel(0)._exp);

      }
      // this._view.tfmDuration
      this._view.render(cur_config);
      ctx.drawImage(gl.canvas, 0, 0);


      // ループのために再帰呼び出し
      var filter_str = 'contrast(' + cur_config['contrast'].toString() + ')';
      ctx.filter = filter_str;

      // ループのために再帰呼び出し
      requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * シェーダーを登録する。
   */


  /**
   * View情報を取得する。
   */
  public getView(): LAppView {
    return this._view;
  }

  public getTextureManager(): LAppTextureManager {
    return this._textureManager;
  }

  /**
   * コンストラクタ
   */
  constructor() {
    this._captured = false;
    this._mouseX = 0.0;
    this._mouseY = 0.0;
    this._isEnd = false;

    this._cubismOption = new Option();
    this._view = new LAppView();
    this._textureManager = new LAppTextureManager();
  }

  /**
   * Cubism SDKの初期化
   */
  public initializeCubism(): void {
    // setup cubism
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismFramework.startUp(this._cubismOption);

    // initialize cubism
    CubismFramework.initialize();

    // load model
    LAppLive2DManager.getInstance();

    LAppLive2DManager.getInstance().loadAllModel();

    LAppPal.updateTime();

    this._view.initializeSprite();
  }

  /**
   * Resize the canvas to fill the screen.
   */
  private _resizeCanvas(): void {
    canvas_gl.width = window.innerWidth;
    canvas_gl.height = window.innerHeight;
  }

  _cubismOption: Option; // Cubism SDK Option
  _view: LAppView; // View情報
  _captured: boolean; // クリックしているか
  _mouseX: number; // マウスX座標
  _mouseY: number; // マウスY座標
  _isEnd: boolean; // APP終了しているか
  _textureManager: LAppTextureManager; // テクスチャマネージャー
}

/**
 * クリックしたときに呼ばれる。
 */
function onClickBegan(e: MouseEvent): void {
  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }
  LAppDelegate.getInstance()._captured = true;

  const posX: number = e.pageX;
  const posY: number = e.pageY;

  LAppDelegate.getInstance()._view.onTouchesBegan(posX, posY);
}

/**
 * マウスポインタが動いたら呼ばれる。
 */
function onMouseMoved(e: MouseEvent): void {
  LAppDelegate.getInstance()._captured = true; //

  if (!LAppDelegate.getInstance()._captured) {
    return;
  }

  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();
  const posX: number = e.clientX - rect.left;
  const posY: number = e.clientY - rect.top;

  LAppDelegate.getInstance()._view.onTouchesMoved(posX, posY);
}

/**
 * クリックが終了したら呼ばれる。
 */
function onClickEnded(e: MouseEvent): void {
  // LAppDelegate.getInstance()._captured = false;
  LAppDelegate.getInstance()._captured = true; //

  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();
  const posX: number = e.clientX - rect.left;
  const posY: number = e.clientY - rect.top;

  LAppDelegate.getInstance()._view.onTouchesEnded(posX, posY);
}

/**
 * タッチしたときに呼ばれる。
 */
function onTouchBegan(e: TouchEvent): void {
  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  LAppDelegate.getInstance()._captured = true;

  const posX = e.changedTouches[0].pageX;
  const posY = e.changedTouches[0].pageY;

  LAppDelegate.getInstance()._view.onTouchesBegan(posX, posY);
}

/**
 * スワイプすると呼ばれる。
 */
function onTouchMoved(e: TouchEvent): void {
  if (!LAppDelegate.getInstance()._captured) {
    return;
  }

  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();

  const posX = e.changedTouches[0].clientX - rect.left;
  const posY = e.changedTouches[0].clientY - rect.top;

  LAppDelegate.getInstance()._view.onTouchesMoved(posX, posY);
}

/**
 * タッチが終了したら呼ばれる。
 */
function onTouchEnded(e: TouchEvent): void {
  LAppDelegate.getInstance()._captured = false;

  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();

  const posX = e.changedTouches[0].clientX - rect.left;
  const posY = e.changedTouches[0].clientY - rect.top;

  LAppDelegate.getInstance()._view.onTouchesEnded(posX, posY);
}

/**
 * タッチがキャンセルされると呼ばれる。
 */
function onTouchCancel(e: TouchEvent): void {
  LAppDelegate.getInstance()._captured = false;

  if (!LAppDelegate.getInstance()._view) {
    LAppPal.printMessage('view notfound');
    return;
  }

  const rect = (e.target as Element).getBoundingClientRect();

  const posX = e.changedTouches[0].clientX - rect.left;
  const posY = e.changedTouches[0].clientY - rect.top;

  LAppDelegate.getInstance()._view.onTouchesEnded(posX, posY);
}
interface Dict {
  [idx: string]: number
}