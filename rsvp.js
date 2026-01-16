/**
 * RSVP (Rapid Serial Visual Presentation) Reading Mode
 * Displays words one at a time with ORP highlighting
 */

(function() {
  'use strict';

  // Configuration
  const DEFAULT_WPM = 250;
  const MIN_WPM = 100;
  const MAX_WPM = 500;
  const WPM_STEP = 50;

  // State
  let words = [];
  let currentIndex = 0;
  let isPlaying = false;
  let wpm = DEFAULT_WPM;
  let intervalId = null;
  let startWord = null;

  /**
   * Initialize RSVP system
   */
  function init() {
    createToggleButton();
    createModal();
    setupEventListeners();
  }

  /**
   * Create the RSVP toggle button
   */
  function createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'rsvp-toggle';
    toggleBtn.className = 'rsvp-toggle';
    toggleBtn.innerHTML = '⚡';
    toggleBtn.setAttribute('aria-label', 'Toggle RSVP reading mode');
    toggleBtn.title = 'RSVP Reader';
    document.body.appendChild(toggleBtn);
  }

  /**
   * Create the RSVP modal
   */
  function createModal() {
    const overlay = document.createElement('div');
    overlay.id = 'rsvp-overlay';
    overlay.className = 'rsvp-overlay';
    
    overlay.innerHTML = `
      <div class="rsvp-modal" role="dialog" aria-labelledby="rsvp-title" aria-modal="true">
        <div class="rsvp-header">
          <h2 id="rsvp-title">RSVP Reader</h2>
          <button class="rsvp-close" aria-label="Close RSVP reader">×</button>
        </div>
        
        <div class="rsvp-display" id="rsvp-display" aria-live="polite" aria-atomic="true">
          <span class="rsvp-word" id="rsvp-word">Ready</span>
        </div>
        
        <div class="rsvp-controls">
          <div class="rsvp-wpm-control">
            <div class="rsvp-wpm-label">
              <span>Words Per Minute</span>
              <span class="rsvp-wpm-value" id="rsvp-wpm-value">${DEFAULT_WPM}</span>
            </div>
            <input 
              type="range" 
              class="rsvp-wpm-slider" 
              id="rsvp-wpm-slider"
              min="${MIN_WPM}" 
              max="${MAX_WPM}" 
              step="${WPM_STEP}" 
              value="${DEFAULT_WPM}"
              aria-label="Words per minute"
            />
          </div>
          
          <button class="rsvp-play-pause" id="rsvp-play-pause" aria-label="Play">
            ▶ Start
          </button>
          
          <div class="rsvp-status" id="rsvp-status"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    const toggleBtn = document.getElementById('rsvp-toggle');
    const overlay = document.getElementById('rsvp-overlay');
    const closeBtn = document.querySelector('.rsvp-close');
    const playPauseBtn = document.getElementById('rsvp-play-pause');
    const wpmSlider = document.getElementById('rsvp-wpm-slider');

    toggleBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    playPauseBtn.addEventListener('click', togglePlayPause);
    wpmSlider.addEventListener('input', handleWpmChange);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Focus trap in modal
    setupFocusTrap();
  }

  /**
   * Setup focus trap for accessibility
   */
  function setupFocusTrap() {
    const modal = document.querySelector('.rsvp-modal');
    const overlay = document.getElementById('rsvp-overlay');
    
    overlay.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('active')) return;
      
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    });
  }

  /**
   * Open the RSVP modal
   */
  function openModal() {
    const overlay = document.getElementById('rsvp-overlay');
    const closeBtn = document.querySelector('.rsvp-close');
    
    // Extract text and determine starting position
    extractText();
    
    // Reset state
    currentIndex = 0;
    isPlaying = false;
    updatePlayPauseButton();
    displayCurrentWord();
    
    // Show modal
    overlay.classList.add('active');
    
    // Focus close button for accessibility
    setTimeout(() => closeBtn.focus(), 100);
  }

  /**
   * Close the RSVP modal
   */
  function closeModal() {
    const overlay = document.getElementById('rsvp-overlay');
    
    // Stop playback
    if (isPlaying) {
      stopPlayback();
    }
    
    // Hide modal
    overlay.classList.remove('active');
    
    // Return focus to toggle button
    document.getElementById('rsvp-toggle').focus();
  }

  /**
   * Extract text content from the document
   */
  function extractText() {
    const main = document.querySelector('main');
    if (!main) {
      words = ['No', 'content', 'found'];
      return;
    }

    // Get starting position
    const startPosition = getStartingPosition();
    
    // Extract all text nodes
    const textNodes = [];
    const walker = document.createTreeWalker(
      main,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script tags, style tags, and empty text
          if (node.parentElement.tagName === 'SCRIPT' ||
              node.parentElement.tagName === 'STYLE' ||
              !node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while ((node = walker.nextNode()) !== null) {
      textNodes.push(node);
    }

    // Convert text nodes to words
    words = [];
    let foundStart = false;
    
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      const nodeWords = text.match(/\S+/g) || [];
      
      // Check if this is the starting text node
      if (!foundStart && startPosition && textNode === startPosition.node) {
        // Split at the starting offset
        const beforeCaret = text.substring(0, startPosition.offset);
        const afterCaret = text.substring(startPosition.offset);
        
        const beforeWords = beforeCaret.match(/\S+/g) || [];
        const afterWords = afterCaret.match(/\S+/g) || [];
        
        // Start from the word after the caret
        words.push(...afterWords);
        foundStart = true;
      } else if (!foundStart && startPosition) {
        // Skip words before the starting position
        continue;
      } else {
        words.push(...nodeWords);
      }
    }

    // If we didn't find a starting position, use all words
    if (!foundStart) {
      words = [];
      for (const textNode of textNodes) {
        const nodeWords = textNode.textContent.match(/\S+/g) || [];
        words.push(...nodeWords);
      }
    }

    // Fallback if no words found
    if (words.length === 0) {
      words = ['No', 'readable', 'content', 'found'];
    }
  }

  /**
   * Get starting position (caret/selection/viewport)
   */
  function getStartingPosition() {
    const selection = window.getSelection();
    
    // Check for active selection or caret position
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      return {
        node: range.startContainer,
        offset: range.startOffset
      };
    }
    
    // Fall back to first visible element in viewport
    const main = document.querySelector('main');
    if (main) {
      const walker = document.createTreeWalker(
        main,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            if (node.parentElement.tagName === 'SCRIPT' ||
                node.parentElement.tagName === 'STYLE' ||
                !node.textContent.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            
            const rect = node.parentElement.getBoundingClientRect();
            if (rect.top >= 0 && rect.top <= window.innerHeight) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        },
        false
      );
      
      const firstVisible = walker.nextNode();
      if (firstVisible) {
        return {
          node: firstVisible,
          offset: 0
        };
      }
    }
    
    return null;
  }

  /**
   * Toggle play/pause
   */
  function togglePlayPause() {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  /**
   * Start playback
   */
  function startPlayback() {
    if (currentIndex >= words.length) {
      currentIndex = 0;
    }
    
    isPlaying = true;
    updatePlayPauseButton();
    playNextWord();
  }

  /**
   * Pause playback
   */
  function pausePlayback() {
    isPlaying = false;
    updatePlayPauseButton();
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
  }

  /**
   * Stop playback completely
   */
  function stopPlayback() {
    pausePlayback();
    currentIndex = 0;
    displayCurrentWord();
  }

  /**
   * Play next word
   */
  function playNextWord() {
    if (!isPlaying) return;
    
    if (currentIndex >= words.length) {
      // Finished
      isPlaying = false;
      updatePlayPauseButton();
      updateStatus('Finished! Click Start to replay.');
      currentIndex = 0;
      return;
    }
    
    displayCurrentWord();
    currentIndex++;
    
    // Calculate delay based on WPM
    const delay = (60 / wpm) * 1000;
    
    // Schedule next word
    intervalId = setTimeout(playNextWord, delay);
  }

  /**
   * Display current word with ORP highlighting
   */
  function displayCurrentWord() {
    const wordElement = document.getElementById('rsvp-word');
    
    if (currentIndex >= words.length) {
      wordElement.innerHTML = 'Ready';
      wordElement.style.paddingLeft = '0';
      wordElement.style.paddingRight = '0';
      updateStatus('');
      return;
    }
    
    const word = words[currentIndex];
    const orpIndex = calculateORP(word);
    
    // Build word with ORP highlighting
    let html = '';
    for (let i = 0; i < word.length; i++) {
      if (i === orpIndex) {
        html += `<span class="rsvp-orp">${escapeHtml(word[i])}</span>`;
      } else {
        html += escapeHtml(word[i]);
      }
    }
    
    wordElement.innerHTML = html;
    
    // Calculate padding to anchor ORP at fixed position
    // Use monospace character width approximation
    const displayElement = document.getElementById('rsvp-display');
    const computedStyle = window.getComputedStyle(displayElement);
    const fontSize = parseFloat(computedStyle.fontSize);
    
    // For monospace fonts, character width is approximately 0.6 * fontSize
    const charWidth = fontSize * 0.6;
    
    // Calculate center position of display area
    const displayWidth = displayElement.clientWidth;
    const centerX = displayWidth / 2;
    
    // Position where ORP should be (at center)
    const orpTargetX = centerX;
    
    // Calculate actual position of ORP character in the word
    const charsBeforeORP = orpIndex;
    const wordWidthBeforeORP = charsBeforeORP * charWidth;
    
    // Calculate required left padding to align ORP to center
    const requiredPaddingLeft = orpTargetX - wordWidthBeforeORP - (charWidth / 2);
    
    // Apply padding
    wordElement.style.paddingLeft = Math.max(0, requiredPaddingLeft) + 'px';
    
    updateStatus(`Word ${currentIndex + 1} of ${words.length}`);
  }

  /**
   * Calculate ORP (Optimal Recognition Point) index
   * Based on word length and structure
   */
  function calculateORP(word) {
    const length = word.length;
    
    // For very short words (1-2 chars), highlight first character
    if (length <= 2) {
      return 0;
    }
    
    // For short words (3-5 chars), highlight slightly off-center
    if (length <= 5) {
      return 1;
    }
    
    // For medium words (6-9 chars), highlight around 1/3 position
    if (length <= 9) {
      return Math.floor(length / 3);
    }
    
    // For long words (10-13 chars), highlight slightly before center
    if (length <= 13) {
      return Math.floor(length * 0.35);
    }
    
    // For very long words, highlight a bit earlier
    return Math.floor(length * 0.3);
  }

  /**
   * Handle WPM slider change
   */
  function handleWpmChange(e) {
    wpm = parseInt(e.target.value, 10);
    document.getElementById('rsvp-wpm-value').textContent = wpm;
  }

  /**
   * Update play/pause button
   */
  function updatePlayPauseButton() {
    const btn = document.getElementById('rsvp-play-pause');
    if (isPlaying) {
      btn.innerHTML = '⏸ Pause';
      btn.setAttribute('aria-label', 'Pause');
    } else {
      btn.innerHTML = '▶ Start';
      btn.setAttribute('aria-label', 'Play');
    }
  }

  /**
   * Update status message
   */
  function updateStatus(message) {
    const statusElement = document.getElementById('rsvp-status');
    if (statusElement) {
      statusElement.textContent = message;
    }
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
