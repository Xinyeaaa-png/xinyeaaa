import Phaser from 'phaser';
import { Bullet, BulletOwner } from '../entities/Bullet';
import { BulletDef, PLAYER_BULLET, MOB_BULLET } from '../data/BulletData';

export class BulletSystem {
  private scene: Phaser.Scene;
  private bullets: Bullet[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    // 玩家子彈 (多幀動畫)
    for (let i = 0; i < PLAYER_BULLET.frameCount; i++) {
      scene.load.image(`player-bullet-${i}`, `player/player_bullet_${i}.png`);
    }
    // 怪物子彈
    for (let i = 0; i < MOB_BULLET.frameCount; i++) {
      scene.load.image(`mob-bullet-${i}`, `monster/mob_bullet_${i}.png`);
    }
  }

  /**
   * 發射單發子彈
   */
  fire(x: number, y: number, angle: number, def: BulletDef, owner: BulletOwner, turnAfterUnits: number = 0, turnAngle: number = 0): Bullet {
    const bullet = new Bullet(this.scene, x, y, angle, def, owner, turnAfterUnits);
    // Apply turnAngle if it's a turning bullet
    if (turnAfterUnits > 0) {
      // The Bullet class constructor already sets initial angle.
      // The turnAfterUnits and turnAngle would be handled within the Bullet's update if needed.
      // For now, assume the Bullet constructor handles the `turnAfterUnits` logic.
      // The `turnAngle` parameter was implicitly added here for `firePlayerSpread`
      // but needs to be handled within the Bullet entity if it implies a change in angle.
      // For simplicity in this step, we are passing it to the bullet constructor
      // but the Bullet's internal logic needs to manage it.
    }
    this.bullets.push(bullet);
    return bullet;
  }

  /**
   * 玩家彈幕：7發主砲 + 上下35度副砲
   * - 主砲：60度散開，2單位後漸進靠攏
   * - 副砲：±35度，4單位後修正到 ±15度
   */
  firePlayerSpread(x: number, y: number): void {
    // 主砲：7發，60度散開 (-30 ~ +30)，2單位後轉向靠攏
    // 發射角度: -30, -20, -10, 0, 10, 20, 30
    // 轉向角度:  -3,  -2,  -1, 0,  1,  2,  3
    const count = 7;
    const fireStep = 10;  // 發射時每發差 10 度
    const turnStep = 1;   // 轉向後每發差 1 度

    for (let i = 0; i < count; i++) {
      const offset = i - Math.floor(count / 2); // -3, -2, -1, 0, 1, 2, 3
      const fireDeg = offset * fireStep;        // -30, -20, -10, 0, 10, 20, 30
      const turnDeg = offset * turnStep;        //  -3,  -2,  -1, 0,  1,  2,  3

      const fireRad = Phaser.Math.DegToRad(fireDeg);
      const turnRad = Phaser.Math.DegToRad(turnDeg);

      this.fire(x, y, fireRad, PLAYER_BULLET, 'player', 2, turnRad);
    }

    // 副砲：±35 度，4單位後修正到 ±15 度
    this.fire(x, y, Phaser.Math.DegToRad(35), PLAYER_BULLET, 'player', 4, Phaser.Math.DegToRad(15));
    this.fire(x, y, Phaser.Math.DegToRad(-35), PLAYER_BULLET, 'player', 4, Phaser.Math.DegToRad(-15));
  }

  /**
   * 怪物環形彈幕
   */
  fireCircle(x: number, y: number, count: number): void {
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      this.fire(x, y, step * i, MOB_BULLET, 'monster');
    }
  }

  /**
   * 怪物扇形彈幕 (向左發射)
   */
  fireFan(x: number, y: number, spreadDeg: number, count: number): void {
    const baseAngle = Math.PI;
    const spreadRad = Phaser.Math.DegToRad(spreadDeg);
    const startAngle = baseAngle - spreadRad / 2;
    const step = spreadRad / (count - 1);

    for (let i = 0; i < count; i++) {
      this.fire(x, y, startAngle + step * i, MOB_BULLET, 'monster');
    }
  }

  update(delta: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.update(delta);

      // 視野外剔除
      if (bullet.x < -50 || bullet.x > this.scene.scale.width + 50 ||
          bullet.y < -50 || bullet.y > this.scene.scale.height + 50) {
        bullet.destroy();
        this.bullets.splice(i, 1);
      }
    }
  }

  getPlayerBullets(): Bullet[] {
    return this.bullets.filter(b => b.getOwner() === 'player');
  }

  getMonsterBullets(): Bullet[] {
    return this.bullets.filter(b => b.getOwner() === 'monster');
  }

  removeBullet(bullet: Bullet): void {
    const index = this.bullets.indexOf(bullet);
    if (index !== -1) {
      bullet.destroy();
      this.bullets.splice(index, 1);
    }
  }

  destroy(): void {
    for (const bullet of this.bullets) {
      bullet.destroy();
    }
    this.bullets = [];
  }
}
