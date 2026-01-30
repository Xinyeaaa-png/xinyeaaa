import Phaser from 'phaser';
import { UNIT_SIZE } from '../config/GameConfig';
import { BulletDef } from '../data/BulletData';

export type BulletOwner = 'player' | 'monster';

export class Bullet extends Phaser.GameObjects.Sprite {
  private def: BulletDef;
  private owner: BulletOwner;
  private velocityX: number;
  private velocityY: number;

  // 轉向系統
  private startX: number;
  private startY: number;
  private turnDistance: number = 0;
  private hasTurned: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    def: BulletDef,
    owner: BulletOwner,
    turnAfterUnits: number = 0
  ) {
    super(scene, x, y, `${def.key}-0`);
    scene.add.existing(this as Phaser.GameObjects.Sprite);

    this.def = def;
    this.owner = owner;
    this.startX = x;
    this.startY = y;
    this.turnDistance = turnAfterUnits * UNIT_SIZE;
    this.velocityX = Math.cos(angle) * def.speed;
    this.velocityY = Math.sin(angle) * def.speed;

    this.setDepth(owner === 'player' ? 7 : 9);
    this.setRotation(angle);
    this.setUnitSize(def.unitSize);
    this.initAnimation();
  }

  update(delta: number): void {
    const dt = delta / 1000;
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    // 檢查是否需要轉向
    if (this.turnDistance > 0 && !this.hasTurned) {
      const traveled = Phaser.Math.Distance.Between(
        this.startX, this.startY, this.x, this.y
      );
      if (traveled >= this.turnDistance) {
        this.hasTurned = true;
        this.velocityX = this.def.speed;
        this.velocityY = 0;
        this.setRotation(0);
      }
    }
  }

  // ... 其他方法

  private setUnitSize(units: number): void {
    if (units === 0) return; // Don't scale if units is 0

    const targetSize = UNIT_SIZE * units;
    const maxDimension = Math.max(this.width, this.height);
    const scale = targetSize / maxDimension;
    this.setScale(scale);
  }

  private initAnimation(): void {
    const animKey = `${this.def.key}-anim`;
    if (this.scene.anims.exists(animKey)) {
      this.play(animKey);
      return;
    }

    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (let i = 0; i < this.def.frameCount; i++) {
      frames.push({ key: `${this.def.key}-${i}` });
    }

    this.scene.anims.create({
      key: animKey,
      frames: frames,
      frameRate: 10,
      repeat: -1,
    });
    this.play(animKey);
  }

  getDamage(): number {
    return this.def.damage;
  }

  getRadius(): number {
    // Assuming circular collision, radius is half of the smallest dimension
    return Math.min(this.displayWidth, this.displayHeight) / 2;
  }

  getOwner(): BulletOwner {
    return this.owner;
  }
}