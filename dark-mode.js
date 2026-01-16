/**
 * Dark Mode Toggle System
 * Manages theme switching with localStorage persistence
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'theme';
  const THEME_DARK = 'dark';
  const THEME_LIGHT = 'light';

  /**
   * Get the initial theme preference
   * Priority: localStorage > system preference > light
   */
  function getInitialTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === THEME_DARK || stored === THEME_LIGHT) {
        return stored;
      }
    } catch (e) {
      console.warn('localStorage not available:', e);
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEME_DARK;
    }

    return THEME_LIGHT;
  }

  /**
   * Apply theme to document
   */
  function applyTheme(theme) {
    if (theme === THEME_DARK) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  /**
   * Save theme preference
   */
  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' 
      ? THEME_DARK 
      : THEME_LIGHT;
    const next = current === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    
    applyTheme(next);
    saveTheme(next);
    updateToggleButton(next);
  }

  /**
   * Update the toggle button appearance
   */
  function updateToggleButton(theme) {
    const btn = document.getElementById('dark-mode-toggle');
    if (!btn) return;

    if (theme === THEME_DARK) {
      btn.innerHTML = '☀️';
      btn.setAttribute('aria-label', 'Switch to light mode');
      btn.title = 'Light mode';
    } else {
      btn.innerHTML = '🌙';
      btn.setAttribute('aria-label', 'Switch to dark mode');
      btn.title = 'Dark mode';
    }
  }

  /**
   * Create and insert the dark mode toggle button
   */
  function createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'dark-mode-toggle';
    btn.className = 'dark-mode-toggle';
    btn.addEventListener('click', toggleTheme);
    
    // Insert into header
    const header = document.querySelector('header .wrap, header .topbar');
    if (header) {
      header.appendChild(btn);
    } else {
      // Fallback: insert at top of body
      document.body.insertBefore(btn, document.body.firstChild);
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' 
      ? THEME_DARK 
      : THEME_LIGHT;
    updateToggleButton(currentTheme);
  }

  /**
   * Listen for system theme changes
   */
  function watchSystemTheme() {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only auto-switch if user hasn't set a preference
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const newTheme = e.matches ? THEME_DARK : THEME_LIGHT;
          applyTheme(newTheme);
          updateToggleButton(newTheme);
        }
      } catch (err) {
        console.warn('Failed to handle system theme change:', err);
      }
    });
  }

  /**
   * Initialize dark mode
   */
  function init() {
    // Wait for DOM to be ready for toggle button
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createToggleButton();
        watchSystemTheme();
      });
    } else {
      createToggleButton();
      watchSystemTheme();
    }
  }

  // Apply theme immediately to prevent flash (before DOM is ready)
  const theme = getInitialTheme();
  applyTheme(theme);

  // Initialize toggle button and watchers when ready
  init();

})();
