class ThemeService {
  constructor() {
    this.themes = {
      dark: {
        name: '暗黑主题',
        colors: {
          background: '#1a1a1a',
          surface: '#252525',
          border: '#333',
          text: '#fff',
          textSecondary: '#999',
          accent: '#007acc',
          success: '#4CAF50',
          error: '#ff6b6b',
          hover: '#333',
          selection: '#444'
        }
      },
      light: {
        name: '明亮主题',
        colors: {
          background: '#ffffff',
          surface: '#f5f5f5',
          border: '#e0e0e0',
          text: '#333333',
          textSecondary: '#666666',
          accent: '#2196F3',
          success: '#4CAF50',
          error: '#f44336',
          hover: '#eeeeee',
          selection: '#e3f2fd'
        }
      },
      pixel: {
        name: '像素风格',
        colors: {
          background: '#282828',
          surface: '#383838',
          border: '#484848',
          text: '#00ff00',
          textSecondary: '#00cc00',
          accent: '#00ffff',
          success: '#00ff00',
          error: '#ff0000',
          hover: '#484848',
          selection: '#686868'
        }
      },
      zen: {
        name: '极简风格',
        colors: {
          background: '#fafafa',
          surface: '#ffffff',
          border: '#f0f0f0',
          text: '#333333',
          textSecondary: '#999999',
          accent: '#333333',
          success: '#333333',
          error: '#333333',
          hover: '#f5f5f5',
          selection: '#f0f0f0'
        }
      }
    };

    this.currentTheme = 'dark';
    this.loadTheme();
  }

  getThemes() {
    return Object.entries(this.themes).map(([id, theme]) => ({
      id,
      name: theme.name
    }));
  }

  getCurrentTheme() {
    return this.themes[this.currentTheme];
  }

  setTheme(themeId) {
    if (this.themes[themeId]) {
      this.currentTheme = themeId;
      this.applyTheme();
      localStorage.setItem('theme', themeId);
    }
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && this.themes[savedTheme]) {
      this.currentTheme = savedTheme;
    }
    this.applyTheme();
  }

  applyTheme() {
    const theme = this.getCurrentTheme();
    const root = document.documentElement;

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // 设置主题类名，用于特殊样式
    root.className = this.currentTheme;
  }
}

export default new ThemeService(); 