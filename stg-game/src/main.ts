import Phaser from 'phaser';

// A minimal style sheet to prevent import errors
import './style.css'; 

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 800,
  height: 600,
  scene: {
    create: function () {
      this.add.text(100, 100, 'v0.0.0 Setup Complete!', { color: '#00ff00' });
    }
  }
};

new Phaser.Game(config);