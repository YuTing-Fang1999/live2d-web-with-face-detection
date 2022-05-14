/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';

import * as LAppDefine from './lappdefine';
import { canvas_gl, gl, LAppDelegate } from './lappdelegate';
import { LAppLive2DManager } from './lapplive2dmanager';
// import { Expression } from './lapplive2dmanager';
import { LAppPal } from './lapppal';
import { LAppSprite } from './lappsprite';
import { TextureInfo } from './lapptexturemanager';
import { TouchManager } from './touchmanager';



/**
 * 描画クラス。
 */
export class LAppView {
  /**
   * コンストラクタ
   */
  constructor() {
    this._programId = null;
    this._programId2 = null;
    this._back = null;
    this._gear = null;
    this._bar = null;

    // タッチ関係のイベント管理
    this._touchManager = new TouchManager();

    // デバイス座標からスクリーン座標に変換するための
    this._deviceToScreen = new CubismMatrix44();

    // 画面の表示の拡大縮小や移動の変換を行う行列
    this._viewMatrix = new CubismViewMatrix();

    this.state = 0;
    this.socket_state = 0;
    this.transforming = false;
    this.tfmDuration = 10.0;
    this.configs = this.setConfig();
    this.cur_config = {};
    Object.assign(this.cur_config, this.configs[this.state]);


  }

  /**
   * 初期化する。
   */
  public initialize(): void {
    const { width, height } = canvas_gl;

    const ratio: number = width / height;
    const left: number = -ratio;
    const right: number = ratio;
    const bottom: number = LAppDefine.ViewLogicalLeft;
    const top: number = LAppDefine.ViewLogicalRight;

    this._viewMatrix.setScreenRect(left, right, bottom, top); // デバイスに対応する画面の範囲。 Xの左端、Xの右端、Yの下端、Yの上端
    this._viewMatrix.scale(LAppDefine.ViewScale, LAppDefine.ViewScale);

    this._deviceToScreen.loadIdentity();
    if (width > height) {
      const screenW: number = Math.abs(right - left);
      this._deviceToScreen.scaleRelative(screenW / width, -screenW / width);
    } else {
      const screenH: number = Math.abs(top - bottom);
      this._deviceToScreen.scaleRelative(screenH / height, -screenH / height);
    }
    this._deviceToScreen.translateRelative(-width * 0.5, -height * 0.5);

    // 表示範囲の設定
    this._viewMatrix.setMaxScale(LAppDefine.ViewMaxScale); // 限界拡張率
    this._viewMatrix.setMinScale(LAppDefine.ViewMinScale); // 限界縮小率

    // 表示できる最大範囲
    this._viewMatrix.setMaxScreenRect(
      LAppDefine.ViewLogicalMaxLeft,
      LAppDefine.ViewLogicalMaxRight,
      LAppDefine.ViewLogicalMaxBottom,
      LAppDefine.ViewLogicalMaxTop
    );

  }


  /**
   * 解放する
   */
  public release(): void {
    this._viewMatrix = null;
    this._touchManager = null;
    this._deviceToScreen = null;

    this._gear.release();
    this._gear = null;

    this._bar.release();
    this._bar = null;

    this._back.release();
    this._back = null;

    gl.deleteProgram(this._programId);
    this._programId = null;

    gl.deleteProgram(this._programId2);
    this._programId2 = null;
  }

  /**
   * 描画する。
   */
  public render(config: Dict): void {
    gl.useProgram(this._programId);

    if (this._back) {
      this._back.render(this._programId, config['bg_add_r'], config['bg_add_g'], config['bg_add_b']);
    }

    if (this._gear) {
      this._gear.render(this._programId, config['bg_add_r'], config['bg_add_g'], config['bg_add_b']);
    }

    gl.useProgram(this._programId2);
    if (this._bar) {
      this._bar.render(this._programId2, 0.0, 0.0, 0.0);
    }

    gl.flush();

    const live2DManager: LAppLive2DManager = LAppLive2DManager.getInstance();

    live2DManager.setViewMatrix(this._viewMatrix);

    // live2DManager.onUpdate();
    live2DManager.onUpdate(live2DManager._sceneIndex, config['model_r'], config['model_g'], config['model_b'], 1.0);
  }

  /**
   * 画像の初期化を行う。
   */
  public initializeSprite(): void {
    const width: number = canvas_gl.width;
    const height: number = canvas_gl.height;

    const textureManager = LAppDelegate.getInstance().getTextureManager();
    const resourcesPath = LAppDefine.ResourcesPath;

    let imageName = '';

    // 背景画像初期化
    imageName = LAppDefine.BackImageName;

    // 非同期なのでコールバック関数を作成
    const initBackGroundTexture = (textureInfo: TextureInfo): void => {
      const x: number = width * 0.5;
      const y: number = height * 0.5;

      const fwidth = textureInfo.width * 2.0;
      const fheight = height * 0.95;
      this._back = new LAppSprite(x, y, fwidth, fheight, textureInfo.id);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initBackGroundTexture
    );

    // 歯車画像初期化
    imageName = LAppDefine.GearImageName;
    const initGearTexture = (textureInfo: TextureInfo): void => {
      const x = width - textureInfo.width * 0.5;
      const y = height - textureInfo.height * 0.5;
      const fwidth = textureInfo.width;
      const fheight = textureInfo.height;
      this._gear = new LAppSprite(x, y, fwidth, fheight, textureInfo.id);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initGearTexture
    );

    // 画像初期化
    imageName = LAppDefine.BarImageName;
    const initBarTexture = (textureInfo: TextureInfo): void => {
      const x = width * 0.5;
      const y = height - 30;
      const fwidth = textureInfo.width;
      const fheight = textureInfo.height * 0.5;
      this._bar = new LAppSprite(x, y, fwidth, fheight, textureInfo.id);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initBarTexture
    );

    // シェーダーを作成
    if (this._programId == null) {
      // this._programId = LAppDelegate.getInstance().createShader();
      this._programId = this.createShader();
    }
    if (this._programId2 == null) {
      // this._programId2 = LAppDelegate.getInstance().createShader();
      this._programId2 = this.createShader();
    }
  }
  public createShader(): WebGLProgram {

    // バーテックスシェーダーのコンパイル
    const vertexShaderId = gl.createShader(gl.VERTEX_SHADER);

    if (vertexShaderId == null) {
      LAppPal.printMessage('failed to create vertexShader');
      return null;
    }

    const vertexShader: string =
      'precision mediump float;' +
      'attribute vec3 position;' +
      'attribute vec2 uv;' +
      'varying vec2 vuv;' +
      'void main(void)' +
      '{' +
      '   gl_Position = vec4(position, 1.0);' +
      '   vuv = uv;' +
      '}';

    gl.shaderSource(vertexShaderId, vertexShader);
    gl.compileShader(vertexShaderId);

    // フラグメントシェーダのコンパイル
    const fragmentShaderId = gl.createShader(gl.FRAGMENT_SHADER);

    if (fragmentShaderId == null) {
      LAppPal.printMessage('failed to create fragmentShader');
      return null;
    }

    const fragmentShader: string =
      'precision mediump float;' +
      'varying vec2 vuv;' +
      'uniform sampler2D texture;' +
      'uniform vec3 intensity;' +
      'void main(void)' +
      '{' +
      '   vec4 texel = texture2D(texture, vuv);' +
      '   vec3 color = texel.rgb;' +
      '   color = color + intensity;' +
      '   gl_FragColor = vec4(color, texel.a);' +
      '}';



    gl.shaderSource(fragmentShaderId, fragmentShader);
    gl.compileShader(fragmentShaderId);

    // プログラムオブジェクトの作成
    const programId = gl.createProgram();
    gl.attachShader(programId, vertexShaderId);
    gl.attachShader(programId, fragmentShaderId);

    gl.deleteShader(vertexShaderId);
    gl.deleteShader(fragmentShaderId);

    // リンク
    gl.linkProgram(programId);

    gl.useProgram(programId);

    return programId;
  }

  public setConfig(): Dict[] {


    const config = [


      // None
      {
        "bg_add_r": 0.0,
        "bg_add_g": 0.0,
        "bg_add_b": 0.0,
        "model_r": 1.0,
        "model_g": 1.0,
        "model_b": 1.0,
        "contrast": 1.0,
      },
      // happy
      {
        "bg_add_r": 0.1,
        "bg_add_g": 0.1,
        "bg_add_b": 0.1,
        "model_r": 1.1,
        "model_g": 1.1,
        "model_b": 1.1,
        "contrast": 0.9,
      },

      // warm
      {
        "bg_add_r": 0.2,
        "bg_add_g": -0.3,
        "bg_add_b": -0.3,
        "model_r": 0.8,
        "model_g": 0.5,
        "model_b": 0.5,
        "contrast": 0.8,
      },
      // surprise
      {
        "bg_add_r": -0.1,
        "bg_add_g": -0.1,
        "bg_add_b": -0.1,
        "model_r": 0.9,
        "model_g": 0.9,
        "model_b": 0.9,
        "contrast": 0.9,
      },
      // cold
      {
        "bg_add_r": -0.3,
        "bg_add_g": -0.3,
        "bg_add_b": 0.2,
        "model_r": 0.5,
        "model_g": 0.5,
        "model_b": 0.8,
        "contrast": 0.8,
      },
      

      
      

      
    ];

    return config;

    // return result;

  }
  /**
   * タッチされた時に呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesBegan(pointX: number, pointY: number): void {
    this._touchManager.touchesBegan(pointX, pointY);
  }

  /**
   * タッチしているときにポインタが動いたら呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesMoved(pointX: number, pointY: number): void {
    const viewX: number = this.transformViewX(this._touchManager.getX());
    const viewY: number = this.transformViewY(this._touchManager.getY());

    this._touchManager.touchesMoved(pointX, pointY);

    const live2DManager: LAppLive2DManager = LAppLive2DManager.getInstance();
    live2DManager.onDrag(viewX, viewY);
  }

  /**
   * タッチが終了したら呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesEnded(pointX: number, pointY: number): void {
    // タッチ終了
    const live2DManager: LAppLive2DManager = LAppLive2DManager.getInstance();
    // live2DManager.onDrag(0.0, 0.0);

    {
      // シングルタップ
      const x: number = this._deviceToScreen.transformX(
        this._touchManager.getX()
      ); // 論理座標変換した座標を取得。
      const y: number = this._deviceToScreen.transformY(
        this._touchManager.getY()
      ); // 論理座標変化した座標を取得。

      if (LAppDefine.DebugTouchLogEnable) {
        LAppPal.printMessage(`[APP]touchesEnded x: ${x} y: ${y}`);
      }
      live2DManager.onTap(x, y);

      // 歯車にタップしたか
      if (this._gear.isHit(pointX, pointY)) {
        live2DManager.nextStyle();
        // live2DManager.nextScene();
        // LAppLive2DManager.getInstance().getModel(0).nextStyle();
        // LAppLive2DManager.getInstance().getModel(0)._exp = Expression.None;
      }

      // 歯車にタップしたか
      if (this._bar.isHit(pointX, pointY)) {
        // live2DManager.nextScene();
      }
    }
  }

  /**
   * X座標をView座標に変換する。
   *
   * @param deviceX デバイスX座標
   */
  public transformViewX(deviceX: number): number {
    const screenX: number = this._deviceToScreen.transformX(deviceX); // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformX(screenX); // 拡大、縮小、移動後の値。
  }

  /**
   * Y座標をView座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformViewY(deviceY: number): number {
    const screenY: number = this._deviceToScreen.transformY(deviceY); // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformY(screenY);
  }

  /**
   * X座標をScreen座標に変換する。
   * @param deviceX デバイスX座標
   */
  public transformScreenX(deviceX: number): number {
    return this._deviceToScreen.transformX(deviceX);
  }

  /**
   * Y座標をScreen座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformScreenY(deviceY: number): number {
    return this._deviceToScreen.transformY(deviceY);
  }

  _touchManager: TouchManager; // タッチマネージャー
  _deviceToScreen: CubismMatrix44; // デバイスからスクリーンへの行列
  _viewMatrix: CubismViewMatrix; // viewMatrix
  _programId: WebGLProgram; // シェーダID
  _programId2: WebGLProgram; // シェーダID
  _back: LAppSprite; // 背景画像
  _gear: LAppSprite; // ギア画像
  _bar: LAppSprite;
  _changeModel: boolean; // モデル切り替えフラグ
  _isClick: boolean; // クリック中
  state: number;
  next_state: number;
  socket_state: number;
  transforming: boolean;
  tfmDuration: number;
  cur_config: Dict;
  configs: Dict[];
}
interface Dict {
  [idx: string]: number
}