import Phaser from 'phaser';
import { UNIT_SIZE } from '../config/GameConfig';
import { MonsterDef } from '../data/MonsterData';
import { BulletSystem } from '../systems/BulletSystem';
import { MOB_BULLET } from '../data/BulletData';

/**
 * 怪物實體
 * - 從畫面右側生成，向左移動
 * - 碰撞玩家造成傷害
 */
export class Monster extends Phaser.GameObjects.Sprite {
  private def: MonsterDef;
  private currentHp: number;
  private isDead: boolean = false;

  // 行為狀態
  private elapsedTime: number = 0;        // 累計時間 (sine用)
  private baseY: number = 0;              // 基準Y位置 (sine用)
  private targetX: number = 0;            // 目標X (dash用)
  private targetY: number = 0;            // 目標Y (dash用)
  private dashPauseTimer: number = 0;     // 停頓計時 (dash用)
  private isDashing: boolean = false;     // 是否正在衝刺 (dash用)

  // 攻擊系統
  private bulletSystem: BulletSystem;
  private fireTimer: number = 0;
  private fireInterval: number = 0; // ms

  constructor(scene: Phaser.Scene, x: number, y: number, def: MonsterDef, bulletSystem: BulletSystem) {
    super(scene, x, y, `mob-${def.type}-0`);
    scene.add.existing(this as Phaser.GameObjects.Sprite);

    this.def = def;
    this.currentHp = def.hp;
    this.baseY = y;
    this.bulletSystem = bulletSystem;

    this.setDepth(5);  // 怪物層級 (背景之上，玩家之下)
    this.setUnitSize(def.unitSize);
    this.initAnimation();
    this.initBehavior();

    if (this.def.behavior === 'sine') {
      this.fireInterval = 3000; // Small monster: fire every 3 seconds
    } else if (this.def.behavior === 'dash') {
      // Medium monster fires only when paused
      this.fireInterval = 0;
    }
  }

  /**
   * 初始化行為模式
   */
  private initBehavior(): void {
    if (this.def.behavior === 'dash') {
      this.setNextDashTarget();
      this.isDashing = true;
    }
  }

  /**
   * 設定下一個衝刺目標點
   * 往前方3個單位，90度角度內隨機
   */
  private setNextDashTarget(): void {
    const distance = UNIT_SIZE * 3;
    // 90度範圍: -45度 到 +45度 (以左方為基準)
    const angle = Phaser.Math.Between(-45, 45);
    const rad = Phaser.Math.DegToRad(180 + angle); // 180度=左方

    this.targetX = this.x + Math.cos(rad) * distance;
    this.targetY = this.y + Math.sin(rad) * distance;
  }

  /**
   * 設定怪物大小 (以單位為基準)
   */
  private setUnitSize(units: number): void {
    const targetSize = UNIT_SIZE * units;
    const maxDimension = Math.max(this.width, this.height);
    const scale = targetSize / maxDimension;
    this.setScale(scale);
  }

  /**
   * 初始化動畫
   */
  private initAnimation(): void {
    const animKey = `mob-${this.def.type}-idle`;
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey);
      return;
    }

    // 建立動畫
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (let i = 0; i < this.def.frameCount; i++) {
      frames.push({ key: `mob-${this.def.type}-${i}` });
    }

    this.scene.anims.create({
      key: animKey,
      frames: frames,
      frameRate: 6,
      repeat: -1,
    });

    this.play(animKey);
  }

  /**
   * 每幀更新
   */
  update(delta: number): void {
    if (this.isDead) return;

    const dt = delta / 1000;

    switch (this.def.behavior) {
      case 'sine':
        this.updateSine(dt);
        this.fireTimer += delta;
        if (this.fireTimer >= this.fireInterval) {
          this.fireTimer = 0;
          this.fireCircle(8); // Small monster: 8-way circle
        }
        break;
      case 'dash':
        // Dash monster fires when paused
        const wasDashing = this.isDashing;
        this.updateDash(dt);
        if (wasDashing && !this.isDashing) { // Just entered pause state
          // Medium monster: 3 waves of 160-degree fan, 8 bullets each
          this.fireFan(160, 8, 3);
        }
        break;
      default:
        // straight: 單純向左
        this.x -= this.def.speed * dt;
        break;
    }
  }

  /**
   * S形曲線移動
   */
  private updateSine(deltaSeconds: number): void {
    this.elapsedTime += deltaSeconds;

    // 向左移動
    this.x -= this.def.speed * deltaSeconds;

    // Y軸正弦波動 (振幅1單位，週期2秒)
    const amplitude = UNIT_SIZE;
    const frequency = Math.PI; // 2秒一個週期
    this.y = this.baseY + Math.sin(this.elapsedTime * frequency) * amplitude;
  }

  /**
   * 衝刺-停頓移動
   */
  private updateDash(deltaSeconds: number): void {
    if (!this.isDashing) {
      // 停頓中
      this.dashPauseTimer -= deltaSeconds;
      if (this.dashPauseTimer <= 0) {
        this.setNextDashTarget();
        this.isDashing = true;
      }
      return;
    }

    // 衝刺中 - 向目標移動
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      // 到達目標，開始停頓
      this.isDashing = false;
      this.dashPauseTimer = 1; // 停頓1秒
      return;
    }

    // 移動向目標
    const moveSpeed = this.def.speed * 2; // 衝刺速度加倍
    const moveAmount = Math.min(moveSpeed * deltaSeconds, dist);
    this.x += (dx / dist) * moveAmount;
    this.y += (dy / dist) * moveAmount;
  }

  /**
   * 受到傷害
   * @returns true 如果怪物死亡
   */
  takeDamage(amount: number): boolean {
    if (this.isDead) return false;

    this.currentHp -= amount;

    // 受擊閃爍
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => this.clearTint());

    if (this.currentHp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  /**
   * 死亡處理
   */
  private die(): void {
    this.isDead = true;
    // 簡單淡出效果
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.scale * 1.5,
      duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  getExp(): number {
    return this.def.exp;
  }

  getDamage(): number {
    return this.def.damage;
  }

  isAlive(): boolean {
    return !this.isDead;
  }

  getType(): string {
    return this.def.type;
  }

  /**
   * 發射環形子彈
   * @param count 子彈數量
   */
  private fireCircle(count: number): void {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      this.bulletSystem.fire(this.x, this.y, step * i, MOB_BULLET, 'monster');
    }
  }

  /**
   * 發射扇形子彈
   * @param spreadDeg 扇形角度
   * @param count 子彈數量
   * @param waves 波數 (間隔 0.2秒)
   */
  private fireFan(spreadDeg: number, count: number, waves: number): void {
    let currentWave = 0;
    const fireWave = () => {
      if (currentWave >= waves) return;
      // Note: The BulletSystem.fireFan also takes a waves parameter,
      // but here the monster itself controls the waves.
      // So the fireFan on bulletSystem should probably be fireFanSingleWave.
      // For now, let's assume fireFan on bulletSystem handles one wave only.
      this.bulletSystem.fireFan(this.x, this.y, spreadDeg, count);
      currentWave++;
      this.scene.time.delayedCall(200, fireWave); // 0.2秒間隔
    };
    fireWave();
  }
}
