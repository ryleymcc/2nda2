/**
 * Text Highlighting and Note-Saving System
 * Manages note creation, storage, and navigation
 */

(function() {
  'use strict';

  // Configuration
  const STORAGE_KEY = 'pageNotes';
  const HIGHLIGHT_CLASS = 'note-highlight';
  const ACTIVE_HIGHLIGHT_CLASS = 'note-highlight-active';

  // State
  let notes = [];
  let trayOpen = false;
  let contextMenuNote = null;
  let savedSelection = null;

  /**
   * Initialize the note system
   */
  function init() {
    loadNotes();
    createTray();
    setupEventListeners();
    renderNotes();
  }

  /**
   * Get the current page URL (normalized)
   */
  function getCurrentPageUrl() {
    return window.location.pathname;
  }

  /**
   * Load notes from localStorage
   */
  function loadNotes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const allNotes = JSON.parse(stored);
        const currentUrl = getCurrentPageUrl();
        notes = allNotes.filter(note => note.url === currentUrl);
      }
    } catch (e) {
      console.error('Failed to load notes:', e);
      notes = [];
    }
  }

  /**
   * Save notes to localStorage
   */
  function saveNotes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let allNotes = stored ? JSON.parse(stored) : [];
      
      // Remove old notes for this page
      const currentUrl = getCurrentPageUrl();
      allNotes = allNotes.filter(note => note.url !== currentUrl);
      
      // Add current page notes
      allNotes.push(...notes);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  }

  /**
   * Create a note from selected text
   */
  function createNote(selection) {
    if (!selection || selection.isCollapsed) return null;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    
    if (!text) return null;

    // Get position information
    const position = getPositionInfo(range);
    
    const note = {
      id: Date.now().toString() + Math.random().toString().substring(2),
      text: text,
      timestamp: Date.now(),
      url: getCurrentPageUrl(),
      position: position
    };

    notes.push(note);
    saveNotes();
    
    return note;
  }

  /**
   * Get position information for a range
   * Stores XPath and text offset for relocating the text
   */
  function getPositionInfo(range) {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    
    return {
      startXPath: getXPath(startContainer),
      endXPath: getXPath(endContainer),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startText: getContextText(startContainer, range.startOffset),
      endText: getContextText(endContainer, range.endOffset)
    };
  }

  /**
   * Get XPath for a node
   */
  function getXPath(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    
    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = node.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && 
            sibling.nodeName === node.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = node.nodeName.toLowerCase();
      const nth = index > 0 ? `[${index + 1}]` : '';
      parts.unshift(tagName + nth);
      
      node = node.parentNode;
    }
    
    return '/' + parts.join('/');
  }

  /**
   * Get context text around a position for matching
   */
  function getContextText(node, offset) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      const start = Math.max(0, offset - 20);
      const end = Math.min(text.length, offset + 20);
      return text.substring(start, end);
    }
    return '';
  }

  /**
   * Find a node by XPath
   */
  function getNodeByXPath(xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    } catch (e) {
      console.error('XPath evaluation failed:', e);
      return null;
    }
  }

  /**
   * Try to locate and highlight a note's position
   */
  function locateNote(note) {
    try {
      const startNode = getNodeByXPath(note.position.startXPath);
      const endNode = getNodeByXPath(note.position.endXPath);
      
      if (!startNode || !endNode) {
        console.warn('Could not find nodes for note');
        return null;
      }

      // Find text nodes within these elements
      const startTextNode = findTextNode(startNode, note.position.startText);
      const endTextNode = findTextNode(endNode, note.position.endText);
      
      if (!startTextNode || !endTextNode) {
        console.warn('Could not find text nodes');
        return null;
      }

      const range = document.createRange();
      range.setStart(startTextNode, note.position.startOffset);
      range.setEnd(endTextNode, note.position.endOffset);
      
      return range;
    } catch (e) {
      console.error('Failed to locate note:', e);
      return null;
    }
  }

  /**
   * Find text node containing specific text
   */
  function findTextNode(element, contextText) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (contextText.length > 20 && node.textContent.includes(contextText.substring(10, contextText.length - 10))) {
        return node;
      } else if (contextText.length <= 20 && node.textContent.includes(contextText)) {
        return node;
      }
    }
    
    // Fallback: return first text node
    walker.currentNode = element;
    return walker.nextNode();
  }

  /**
   * Jump to a note's position and highlight it
   */
  function jumpToNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    // Remove previous active highlights
    document.querySelectorAll(`.${ACTIVE_HIGHLIGHT_CLASS}`).forEach(el => {
      el.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
    });

    const range = locateNote(note);
    if (!range) {
      alert('Could not find the highlighted text on the page. It may have been modified or removed.');
      return;
    }

    // Scroll to the range
    const rect = range.getBoundingClientRect();
    const scrollTop = window.pageYOffset + rect.top - window.innerHeight / 3;
    window.scrollTo({
      top: scrollTop,
      behavior: 'smooth'
    });

    // Highlight the text temporarily
    setTimeout(() => {
      highlightRange(range, true);
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        document.querySelectorAll(`.${ACTIVE_HIGHLIGHT_CLASS}`).forEach(el => {
          el.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
        });
      }, 3000);
    }, 500);
  }

  /**
   * Highlight a range
   */
  function highlightRange(range, active = false) {
    try {
      const span = document.createElement('span');
      span.className = active ? ACTIVE_HIGHLIGHT_CLASS : HIGHLIGHT_CLASS;
      range.surroundContents(span);
    } catch (e) {
      // If surroundContents fails, try alternative method
      console.warn('Could not highlight range:', e);
    }
  }

  /**
   * Delete a note
   */
  function deleteNote(noteId) {
    notes = notes.filter(n => n.id !== noteId);
    saveNotes();
    renderNotes();
  }

  /**
   * Create the side tray UI
   */
  function createTray() {
    const tray = document.createElement('div');
    tray.id = 'notes-tray';
    tray.className = 'notes-tray';
    
    tray.innerHTML = `
      <div class="notes-tray-header">
        <h3>Notes</h3>
        <button class="notes-tray-close" aria-label="Close notes tray">×</button>
      </div>
      <div class="notes-tray-content">
        <div id="notes-list"></div>
      </div>
    `;
    
    document.body.appendChild(tray);
    
    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'notes-toggle';
    toggleBtn.className = 'notes-toggle';
    toggleBtn.innerHTML = '📝';
    toggleBtn.setAttribute('aria-label', 'Toggle notes tray');
    toggleBtn.title = 'Notes';
    document.body.appendChild(toggleBtn);
    
    // Event listeners
    toggleBtn.addEventListener('click', toggleTray);
    tray.querySelector('.notes-tray-close').addEventListener('click', closeTray);
  }

  /**
   * Render notes in the tray
   */
  function renderNotes() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;

    if (notes.length === 0) {
      notesList.innerHTML = '<p class="notes-empty">No notes yet. Select text and right-click to save a note.</p>';
      return;
    }

    notesList.innerHTML = notes
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(note => `
        <div class="note-item" data-note-id="${note.id}">
          <div class="note-text">${escapeHtml(note.text)}</div>
          <div class="note-footer">
            <span class="note-time">${formatTime(note.timestamp)}</span>
            <button class="note-delete" data-note-id="${note.id}" aria-label="Delete note">Delete</button>
          </div>
        </div>
      `).join('');

    // Add event listeners
    notesList.querySelectorAll('.note-item').forEach(item => {
      const noteId = item.dataset.noteId;
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('note-delete')) {
          jumpToNote(noteId);
        }
      });
    });

    notesList.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.dataset.noteId;
        if (confirm('Delete this note?')) {
          deleteNote(noteId);
        }
      });
    });
  }

  /**
   * Toggle tray visibility
   */
  function toggleTray() {
    if (trayOpen) {
      closeTray();
    } else {
      openTray();
    }
  }

  /**
   * Open the tray
   */
  function openTray() {
    const tray = document.getElementById('notes-tray');
    if (tray) {
      tray.classList.add('open');
      trayOpen = true;
    }
  }

  /**
   * Close the tray
   */
  function closeTray() {
    const tray = document.getElementById('notes-tray');
    if (tray) {
      tray.classList.remove('open');
      trayOpen = false;
    }
  }

  /**
   * Setup event listeners for text selection
   */
  function setupEventListeners() {
    // Context menu
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Handle custom context menu clicks
    document.addEventListener('click', handleDocumentClick);
  }

  /**
   * Handle context menu
   */
  function handleContextMenu(e) {
    // Remove existing custom context menu
    removeCustomContextMenu();

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      return;
    }

    // Prevent default context menu
    e.preventDefault();

    // Save the selection range before it gets cleared
    try {
      savedSelection = {
        range: selection.getRangeAt(0).cloneRange(),
        text: selectedText
      };
    } catch (err) {
      console.error('Failed to save selection:', err);
      return;
    }

    // Create custom context menu
    const menu = document.createElement('div');
    menu.id = 'notes-context-menu';
    menu.className = 'notes-context-menu';
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.innerHTML = `
      <div class="notes-context-menu-item" id="save-note-btn">
        📝 Save to Notes
      </div>
    `;
    
    document.body.appendChild(menu);

    // Add event listener to save note
    document.getElementById('save-note-btn').addEventListener('click', () => {
      if (savedSelection && savedSelection.range) {
        // Create a temporary selection from the saved range
        const tempSelection = {
          getRangeAt: () => savedSelection.range,
          toString: () => savedSelection.text,
          isCollapsed: false
        };
        
        createNote(tempSelection);
        openTray();
        renderNotes();
        
        // Clear the selection
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
        }
        savedSelection = null;
      }
      removeCustomContextMenu();
    });
  }

  /**
   * Remove custom context menu
   */
  function removeCustomContextMenu() {
    const menu = document.getElementById('notes-context-menu');
    if (menu) {
      menu.remove();
    }
  }

  /**
   * Handle document clicks
   */
  function handleDocumentClick(e) {
    // Remove context menu when clicking elsewhere
    if (!e.target.closest('#notes-context-menu')) {
      removeCustomContextMenu();
    }
  }

  /**
   * Format timestamp
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
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
