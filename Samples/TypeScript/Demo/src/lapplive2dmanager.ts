/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { ACubismMotion } from '@framework/motion/acubismmotion';
import { csmVector } from '@framework/type/csmvector';

import * as LAppDefine from './lappdefine';
import { canvas_gl, LAppDelegate, gl } from './lappdelegate';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';

import { LAppView } from './lappview';
import { io } from "socket.io-client";

export enum Expression {
  None,
  Happy,
  Angry,
  Surprise,
  CloseEyes,
}

export let s_instance: LAppLive2DManager = null;

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */

  public static getInstance(): LAppLive2DManager {
    if (s_instance == null) {
      s_instance = new LAppLive2DManager();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance = void 0;
    }

    s_instance = null;
  }

  public loadAllModel() {
    for (let index = 0; index < LAppDefine.ModelDirSize; ++index) {
      const model: string = LAppDefine.ModelDir[index];
      const modelPath: string = LAppDefine.ResourcesPath + model + '/';
      let modelJsonName: string = LAppDefine.ModelDir[index];
      modelJsonName += '.model3.json';

      // this.releaseAllModel();
      this._models.pushBack(new LAppModel());
      this._models.at(index).loadAssets(modelPath, modelJsonName, index);
      console.log(this._models.getSize());
    }
    this.changeScene(0);
    this.initSocketIO();
  }

  public changeStyle(styleNumber) {
    this._sceneIndex = styleNumber;
    // this._view.socket_state = this._exp;
  }

  public nextStyle() {
    this._sceneIndex = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
  }

  onSocketDataRecv(data) {
    // console.log('[lappmodel] [onSocketDataRecv] data: ', data);
    if (data) {
      if (this._exp != Expression.Surprise) {

      
        this._roll = data.roll;
        this._pitch = data.pitch;
        this._yaw = data.yaw;
        this._eyeLOpen = data.eyeLOpen;
        this._eyeROpen = data.eyeROpen;
        this._mouthOpen = data.mouthOpen;
        this._mouthForm = data.mouthForm;

        this._eyeBallX = data.eyeBallX;
        this._eyeBallY = data.eyeBallY;
      }

      //freeze if the expression is surprise
      if (this._exp != Expression.Surprise) {
        if (this._mouthForm == 0 && this._mouthOpen > 0.7) {
          this.updatePregressBar(Expression.Happy);
        }
        else if (this._mouthForm == -2 && this._mouthOpen < 0.2) {
          this.updatePregressBar(Expression.Angry);
        }
        else if (this._mouthForm == -2 && this._mouthOpen > 0.8) {
          this.updatePregressBar(Expression.Surprise);
        }
        else if (this._eyeLOpen < -1 && this._eyeROpen < -1) {
          this.updatePregressBar(Expression.CloseEyes);
        }
        else {
          this._nowExp = Expression.None;
          this._view._bar._rect.right = this._view._bar._rect.oriRight;
        }
      }
    }
  }

  public updatePregressBar(exp) {
    if (this._nowExp == Expression.None) { //start exp
      this._nowExp = exp;
      this._view._bar._rect.right = this._view._bar._rect.oriRight;
    }
    else if (this._nowExp != exp) { //change exp
      this._nowExp = Expression.None;
      this._view._bar._rect.right = this._view._bar._rect.oriRight;
      return;
    }
    // continue do the expression
    if (this._view._bar._rect.right - this._view._bar._rect.left > 0) {
      this._view._bar._rect.right -= 20;

      if (this._view._bar._rect.right - this._view._bar._rect.left <= 0) {
        //set the expression
        this._view._bar._rect.right = this._view._bar._rect.oriRight;
        this._exp = exp;
        this._view.socket_state = this._exp;

        //if exp is Surprise, freeze and change to None after 3s
        // if (exp == Expression.Surprise) {
        setTimeout(() => {
          this._exp = Expression.None;
          this._view.socket_state = this._exp;
          // this.changeStyle(this._exp);
        }, 5000);
        // }
      }
    }

    this._view._bar.release();
    gl.deleteProgram(this._view._programId2);
    this._view._programId2 = this._view.createShader();
    gl.useProgram(this._view._programId2);
    this._view._bar.render(this._view._programId2, 0.0, 0.0, 0.0);
  }

  onSocketDisconnected() {
    console.log('[lappmodel] [onSocketDisconnected] disconnected!');
  }

  initSocketIO() {
    console.log('[lappmodel] [initSocketIO] Try to connect!');
    const socket = io('http://localhost:5252/', { transports: ['websocket'] });
    const onSocketDataRecvBind = this.onSocketDataRecv;
    // const onSocketDataRecvBind2 = this.nextStyle;
    const onSocketDataRecvBind3 = this.updatePregressBar;
    onSocketDataRecvBind.bind(this);
    // onSocketDataRecvBind2.bind(this);
    onSocketDataRecvBind3.bind(this);

    socket.on('connect', () => {
      console.log('[lappmodel] [initSocketIO] connected!');
    });

    //   test sever to client
    // socket.on('date', data => {
    //   // this.nextStyle();
    //   // this.updatePregressBar();
    // });

    socket.on('jsClient', data => {
      this.onSocketDataRecv(data);
    });

    socket.on('disconnect', this.onSocketDisconnected);
  }

  /**
   * 現在のシーンで保持しているモデルを返す。
   *
   * @param no モデルリストのインデックス値
   * @return モデルのインスタンスを返す。インデックス値が範囲外の場合はNULLを返す。
   */
  public getModel(no: number): LAppModel {
    if (no < this._models.getSize()) {
      return this._models.at(no);
    }

    return null;
  }

  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  public releaseAllModel(): void {
    for (let i = 0; i < this._models.getSize(); i++) {
      this._models.at(i).release();
      this._models.set(i, null);
    }

    this._models.clear();
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {

    for (let i = 0; i < this._models.getSize(); i++) {
      const model: LAppModel = this.getModel(i);

      if (model) {
        model.setDragging(x, y);
      }
    }
  }

  /**
   * 画面をタップした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`
      );
    }

    for (let i = 0; i < this._models.getSize(); i++) {
      if (this._models.at(i).hitTest(LAppDefine.HitAreaNameHead, x, y)) {
        if (LAppDefine.DebugLogEnable) {
          LAppPal.printMessage(
            `[APP]hit area: [${LAppDefine.HitAreaNameHead}]`
          );
        }
        // this._models.at(i).setRandomExpression();
      } else if (this._models.at(i).hitTest(LAppDefine.HitAreaNameBody, x, y)) {
        if (LAppDefine.DebugLogEnable) {
          LAppPal.printMessage(
            `[APP]hit area: [${LAppDefine.HitAreaNameBody}]`
          );
        }
        // this._models
        //   .at(i)
        //   .startRandomMotion(
        //     LAppDefine.MotionGroupTapBody,
        //     LAppDefine.PriorityNormal,
        //     this._finishedMotion
        //   );
      }
    }
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(index: number, r: number, g: number, b: number, a: number): void {
    const { width, height } = canvas_gl;

    const modelCount: number = this._models.getSize();
    // console.log('modelCount:', modelCount);

    // for (let i = 0; i < modelCount; ++i) {
    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this.getModel(index);

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 必要があればここで乗算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection, r, g, b, a); // 参照渡しなのでprojectionは変質する。
    // }
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public changeScene(index: number): void {
    this._sceneIndex = index;
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
    }

    // ModelDir[]に保持したディレクトリ名から
    // model3.jsonのパスを決定する。
    // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
    const model: string = LAppDefine.ModelDir[index];
    const modelPath: string = LAppDefine.ResourcesPath + model + '/';
    let modelJsonName: string = LAppDefine.ModelDir[index];
    modelJsonName += '.model3.json';

    // this.releaseAllModel();
    // this._models.pushBack(new LAppModel());
    console.log(this._models.getSize());
    // this._models.at(index).loadAssets(modelPath, modelJsonName, index);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * コンストラクタ
   */
  constructor() {
    this._viewMatrix = new CubismMatrix44();
    this._models = new csmVector<LAppModel>();
    this._sceneIndex = 0;

    ////////////////////////
    this._roll = 0;
    this._pitch = 0;
    this._yaw = 0;
    this._eyeBallX = 0;
    this._eyeBallY = 0;
    this._eyeLOpen = 1;
    this._eyeROpen = 1;
    this._mouthOpen = 0;
    this._mouthForm = 0;

    this._view = LAppDelegate.getInstance()._view;
    this._exp = Expression.None;
    this._nowExp = Expression.None;

    ////////////////////////
  }

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: csmVector<LAppModel>; // モデルインスタンスのコンテナ
  _sceneIndex: number; // 表示するシーンのインデックス値
  // モーション再生終了のコールバック関数
  _finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished:');
    console.log(self);
  };

  //////////////////////////
  _roll: number;
  _pitch: number;
  _yaw: number;
  _eyeBallX: number;
  _eyeBallY: number;
  _eyeLOpen: number;
  _eyeROpen: number;
  _mouthOpen: number;
  _mouthForm: number;

  _view: LAppView; // View情報
  _nowExp: number;
  _exp: number;
  /////////////////////////
}
