// Add these type declarations at the top of the file as a workaround
type CompressionFormat = "gzip" | "deflate" | "deflate-raw";
interface CompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    new(format: CompressionFormat): CompressionStream;
}
declare var CompressionStream: {
    prototype: CompressionStream;
    new(format: CompressionFormat): CompressionStream;
};
interface DecompressionStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    new(format: CompressionFormat): DecompressionStream;
}
declare var DecompressionStream: {
    prototype: DecompressionStream;
    new(format: CompressionFormat): DecompressionStream;
};

import { App, MarkdownRenderer, htmlToMarkdown, Modal, Notice, addIcon, Plugin, PluginSettingTab, Setting, sanitizeHTMLToDom, request, Component, WorkspaceLeaf, TFile, setIcon } from 'obsidian';
import { FRView, VIEW_TYPE_FEEDS_READER, createFeedBar, waitForElm, getNumFromId, nowdatetime } from "./view";
import { getFeedItems, RssFeedContent, itemKeys } from "./getFeed";
import { GLB } from "./globals";

// Remember to rename these classes and interfaces!

interface FeedsReaderSettings {
	feeds_reader_dir: string;
	feeds_data_fname: string;
	subscriptions_fname: string;
	showAll: boolean;
	nItemPerPage: number;
	saveContent: boolean;
	saveSnippetNewToOld: boolean;
	showJot: boolean;
	showSnippet: boolean;
	showRead: boolean;
	showSave: boolean;
	showMath: boolean;
	showGPT: boolean;
	showEmbed: boolean;
	showFetch: boolean;
	showLink: boolean;
	showDelete: boolean;
	chatGPTAPIKey: string;
	chatGPTPrompt: string;
}

const DEFAULT_SETTINGS: FeedsReaderSettings = {
  feeds_reader_dir: 'feeds-reader',
  feeds_data_fname: 'feeds-data.json',
  subscriptions_fname: 'subscriptions.json',
  showAll: false,
  nItemPerPage: 20,
  saveContent: false,
  saveSnippetNewToOld: true,
  showJot: true,
  showSnippet: true,
  showRead: true,
  showSave: true,
  showMath: true,
  showGPT: true,
  showEmbed: true,
  showFetch: true,
  showLink: true,
  showDelete: true,
  chatGPTAPIKey: '',
  chatGPTPrompt: ''
}

export default class FeedsReader extends Plugin {
	settings: FeedsReaderSettings;

	async onload() {
		await this.loadSettings();

    this.registerView(
      VIEW_TYPE_FEEDS_READER,
      (leaf) => new FRView(leaf, this)
    );

		// This creates an icon in the left ribbon.
    //addIcon("circle", `<rect x="120" width="100" height="100" rx="15" fill="currentColor" />`);
    addIcon("circle", `<circle cx="50" cy="50" r="50" fill="currentColor" /> <circle cx="50" cy="50" r="30" fill="cyan" /> <circle cx="50" cy="50" r="10" fill="green" />`);
		const ribbonIconEl = this.addRibbonIcon('rss', 'Feeds reader', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
      this.activateView();
		});

    this.addSettingTab(new FeedReaderSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', async (evt: MouseEvent) => {
      const target = evt.target as HTMLElement;
      if (!target) return;

      // Check if the click target is within a manage button div
      const manageButton = target.closest('.manage > div') as HTMLElement | null;

      if (manageButton) {
          const buttonId = manageButton.id;
          if (buttonId === 'updateAll') {
            GLB.feedList.forEach(async (f) => {
              const [nNew, nTotal] = await updateOneFeed(f.feedUrl);
              if (nNew > 0) {
                new Notice(f.name + ': ' + nTotal.toString() + ' retrieved, '
                           + nNew.toString() + " new.", 3000);
              }
            });
          } else if (buttonId === 'search') {
            new SearchModal(this.app).open(); // Assuming SearchModal needs app instance
          } else if (buttonId === 'showAll') {
            let toggle = document.getElementById('showAll') as HTMLElement;
            const spanInside = toggle?.querySelector('span'); // Get the span inside the div
            if (toggle && spanInside) {
              if (toggle.title.includes('Unread only')) { // Check title instead of innerText
                toggle.title = 'Show all';
                setIcon(spanInside, 'filter-x'); // Change icon to show filter is off
                GLB.showAll = true;
              } else {
                toggle.title = 'Unread only / Show all';
                setIcon(spanInside, 'filter'); // Change icon back
                GLB.showAll = false;
              }
            }
            // Re-render feed list based on new showAll state
            makeDisplayList();
            show_feed();
          } else if (buttonId === 'titleOnly') {
            let toggle = document.getElementById('titleOnly') as HTMLElement;
            const spanInside = toggle?.querySelector('span');
            if (toggle && spanInside) {
              if (toggle.title.includes('Title only')) { // Check title
                toggle.title = 'Show content';
                setIcon(spanInside, 'layout-grid'); // Change icon
                GLB.titleOnly = false;
              } else {
                toggle.title = 'Title only / Show content';
                setIcon(spanInside, 'layout-list'); // Change icon back
                GLB.titleOnly = true;
              }
            }
            // Re-render feed list based on new titleOnly state
            show_feed();
          } else if (buttonId === 'toggleOrder') {
            const toggleOrderDiv = document.getElementById('toggleOrder') as HTMLElement;
            const toggleSpan = toggleOrderDiv?.querySelector('span') as HTMLElement;
            if (toggleSpan && toggleOrderDiv) {
              let nextIcon: string;
              let nextTitle: string;
              if (GLB.itemOrder === 'New to old') {
                GLB.itemOrder = 'Old to new';
                nextIcon = 'arrow-up-down';
                nextTitle = 'Sort: Old to new';
              } else if (GLB.itemOrder === 'Old to new') {
                GLB.itemOrder = 'Random';
                nextIcon = 'shuffle';
                nextTitle = 'Sort: Random';
              } else { // Random
                GLB.itemOrder = 'New to old';
                nextIcon = 'arrow-down-up';
                nextTitle = 'Sort: New to old';
              }
              setIcon(toggleSpan, nextIcon);
              toggleOrderDiv.title = nextTitle;
            }
            // Re-render feed list based on new order
            makeDisplayList();
            show_feed();
          } else if (buttonId === 'saveFeedsData' || buttonId === 'save_data_toggling') {
            const nSaved = await saveFeedsData();
            if (nSaved > 0) {
              new Notice("Data saved: " + nSaved.toString() + 'file(s) updated.', 1000);
            } else {
              new Notice("No need to save.", 1000);
            }
          } else if (buttonId === 'undo') {
              if (GLB.currentFeed != '') {
                GLB.idxItemStart = 0;
                GLB.nPage = 1;
                GLB.displayIndices = GLB.undoList.slice(0, GLB.nItemPerPage);
                show_feed();
              }
          } else if (buttonId === 'addFeed') {
            new AddFeedModal(this.app).open();
          } else if (buttonId === 'manageFeeds') {
            new ManageFeedsModal(this.app).open();
          }
          return; // Prevent further checks if a manage button was clicked
      }

      // Handle toggleNavi click
      if (target.closest('#toggleNavi')) { // Check if the click is on or inside toggleNavi
          const toggle = document.getElementById('toggleNavi');
          const naviBar = document.getElementById('naviBar');
          const contentBox = document.getElementById('contentBox');
          const toggleNaviContainer = document.getElementById('toggleNaviContainer');
          const toggleNaviAux = document.getElementById('toggleNaviAux');

          if (toggle && naviBar && contentBox && toggleNaviContainer && toggleNaviAux) {
              if (naviBar.classList.contains('naviBarHidden')) {
                  // Currently hidden, show it
                  setIcon(toggle, 'panel-left-open');
                  toggle.title = "Hide navigation"; // Update title
                  naviBar.className = 'navigation naviBarShown';
                  contentBox.className = 'content contentBoxRightpage';
                  toggleNaviContainer.className = 'toggleNaviContainer'; // Ensure correct class
                  // Restore unread count if applicable
                  const s = GLB.elUnreadCount?.innerText; // Get text from potentially temporary element
                  GLB.elUnreadCount = document.getElementById('unreadCount' + GLB.currentFeed) || undefined;
                  if (GLB.elUnreadCount && s) GLB.elUnreadCount.innerText = s;
                  toggleNaviAux.empty();
              } else {
                  // Currently shown, hide it
                  setIcon(toggle, 'panel-left-close');
                  toggle.title = "Show navigation"; // Update title
                  naviBar.className = 'navigation naviBarHidden';
                  contentBox.className = 'content contentBoxFullpage';
                  toggleNaviContainer.className = 'toggleNaviContainer'; // Ensure correct class
                  // Show auxiliary info
                  const elUnreadcountWhileToggling = toggleNaviAux.createEl('span', {text: GLB.elUnreadCount?.innerText});
                  elUnreadcountWhileToggling.className = 'unreadcountWhileToggling';
                  GLB.elUnreadCount = elUnreadcountWhileToggling; // Temporarily point GLB reference
                  const save_data_toggling = toggleNaviAux.createEl('span', {text: 'Save progress'});
                  save_data_toggling.id = 'save_data_toggling';
                  save_data_toggling.className = 'save_data_toggling';
              }
          }
          return; // Prevent further checks
      }

      // --- Keep other event listeners below --- 

      if (target.className === 'elUnreadTotalAndRefresh') {
        const fdUrl = target.getAttribute('fdUrl');
        if (!fdUrl) return;
        const [nNew, nTotal] = await updateOneFeed(fdUrl);
        new Notice(target.getAttribute('fdName') + ': '
                   + nTotal.toString() + " retrieved, "
                   + nNew.toString() + ' new.', 3000);
      }
      if (target.className.includes('showFeed')) {
        const previousFeed = GLB.currentFeed;
        GLB.currentFeed = target.id;
        if (GLB.currentFeed === '') {
          return;
        }
        GLB.currentFeedName = '';
        for (let i=0; i<GLB.feedList.length; i++) {
          if (GLB.feedList[i].feedUrl === GLB.currentFeed) {
            GLB.currentFeedName = GLB.feedList[i].name;
            break;
          }
        }
        if (previousFeed != '') {
          const prevElement = document.getElementById(previousFeed);
          if (prevElement) prevElement.className = 'showFeed nonShowingFeed';
        }
        const currentElement = document.getElementById(GLB.currentFeed);
        if (currentElement) currentElement.className = 'showFeed showingFeed';
        if (previousFeed != GLB.currentFeed) {
          GLB.undoList = [];
        }
        GLB.idxItemStart = 0;
        GLB.nPage = 1;
        makeDisplayList();
        const unreadCount = document.getElementById('unreadCount' + GLB.currentFeed);
        GLB.elUnreadCount = unreadCount || undefined;
        show_feed();
      }
      if (target.id === 'nextPage') {
        GLB.idxItemStart += GLB.nItemPerPage;
        GLB.nPage += 1;
        show_feed();
      }
      if (target.id === 'prevPage') {
        GLB.idxItemStart -= GLB.nItemPerPage;
        GLB.nPage -= 1;
        show_feed();
      }
      if (target.className === 'showItemContent') {
        const target = evt.target as HTMLElement;
        if (!target) return;
        const idx = parseInt(target.getAttribute('_idx') || '0');
        if (!idx) return;
        if (target.getAttribute('showContent') === '0') {
          const elID = target.getAttribute('_link');
          if (!elID) return;
          let elContent = document.getElementById('itemContent' + idx);
          if (elContent !== null) {
            elContent.empty();
          } else {
            const parentEl = document.getElementById(elID as string);
            if (!parentEl) return;
            elContent = parentEl.createEl('div');
            elContent.className = 'itemContent';
            elContent.id = 'itemContent' + idx;
          }
          const item = GLB.feedsStore[GLB.currentFeed].items[idx];
          const itemLink = sanitizeHTMLToDom(item.link).textContent;

          if (item.content) {
            try {
              elContent.appendChild(document.createTextNode(item.content.replace(/<img src="\/\//g,"<img src=\"https://")));
            } catch (e) {
              elContent.appendChild(document.createTextNode(item.content.replace(/<img src="\/\//g,"<img src=\"https://")));
            }
          }
          target.setAttribute('showContent', '1');
        } else {
          const elContent = document.getElementById('itemContent' + idx);
          if (elContent !== null) {
            elContent.remove();
          }
          target.setAttribute('showContent', '0');
          const embeddedIframe = document.getElementById('embeddedIframe' + idx);
          if (embeddedIframe !== null) {
            embeddedIframe.remove();
          }
        }
      }
      if (target.className === 'elEmbedButton' && !target.closest('.elEmbedButton')) { // Handle direct click if not handled by closest
        const idx = target.getAttribute('_idx');
        const elID = target.getAttribute('_link');
         // ... (rest of elEmbedButton logic) ...
         return; // Handled
      }
      if (target.className === 'elFetch' && !target.closest('.elFetch')) { // Handle direct click if not handled by closest
        const idx = target.getAttribute('_idx');
        const elID = target.getAttribute('_link');
        // ... (rest of elFetch logic) ...
        return; // Handled
      }

      // --- Handlers remaining in main.ts --- 
      // Restore full logic for handlers previously replaced by comments

      if (target.className === 'renderMath') {
        const idx = getNumFromId(target.id, 'renderMath'); 
        let elContent = document.getElementById('itemContent' + idx);
        const item = GLB.feedsStore[GLB.currentFeed].items[idx];
        if (item.content) {
            const elID = item.link;
            if (elContent !== null) {
              elContent.empty();
            } else {
              const itemEl = document.getElementById(elID);
              if (!itemEl) {
                new Notice('Failed to find element with ID: ' + elID, 1000);
                return;
              }
              elContent = itemEl.createEl('div');
              elContent.id = 'itemContent' + idx;
            }
            if(elContent) { // Check elContent is not null
              elContent.className = 'itemContent';
              MarkdownRenderer.render(this.app,
                remedyLatex(htmlToMarkdown(item.content)), elContent, item.link, this);
            }
          }
         return; // Handled
      }
      if (target.className === 'askChatGPT') {
        const idx = getNumFromId(target.id, 'askChatGPT');
        const item = GLB.feedsStore[GLB.currentFeed].items[idx];
         if (!item.content) {
           return;
         }
         const elID = item.link;
         const el = document.getElementById('shortNoteContainer' + idx);
         if (el === null) {
           const elActionContainer = document.getElementById('actionContainer' + idx);
           if (elActionContainer === null) {
             return;
           }
           const shortNoteContainer = elActionContainer.createEl('div');
           shortNoteContainer.id = 'shortNoteContainer' + idx;
           const shortNote = shortNoteContainer.createEl('textarea');
           shortNote.className = 'shortNote';
           shortNote.id = 'shortNote' + idx;
           shortNote.rows = 2;
           shortNote.placeholder = 'Waiting for ChatGPT to reply...';
         }
         const apiKey = this.settings.chatGPTAPIKey;
         const promptText = this.settings.chatGPTPrompt;
         try {
           let replyByGPT = await fetchChatGPT(apiKey, 0.0,
             promptText + '\n' + item.content);
           replyByGPT = replyByGPT.trim();
           if (replyByGPT !== '') {
             const shortNote = document.getElementById('shortNote' + idx) as HTMLTextAreaElement;
             let existingNote = shortNote.value;
             if (existingNote !== '') {
               existingNote = existingNote + '\n\n';
             }
             shortNote.value = existingNote + replyByGPT;
           }
         } catch (e) {
           console.log(e);
         };
        return; // Handled
      }
      if (target.className === 'noteThis') {
        const idx = getNumFromId(target.id, 'noteThis');
         if (! await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
           await this.app.vault.createFolder(GLB.feeds_reader_dir);
         }
         const the_item = GLB.feedsStore[GLB.currentFeed].items[idx];
         let dt_str: string = '';
         if (the_item.pubDate != '') {
           dt_str = the_item.pubDate;
         } else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') {
           dt_str = GLB.feedsStore[GLB.currentFeed].pubDate;
         } else {
           dt_str = nowdatetime(); 
         }
         dt_str = dt_str.substring(0, 10) + '-';
         const fname: string = dt_str +
                               str2filename(
                               (GLB.currentFeedName === ''? '' :
                                GLB.currentFeedName.replace(/(\s+)/g, '-') + '-') +
                               the_item.title.trim()
                               .replace(/(<([^>]+)>)/g, " ")
                               .replace(/[:!?@#\*\^\$]+/g, '')) + '.md';
         const fpath: string = GLB.feeds_reader_dir + '/' + fname;
         let shortNoteContent = '';
         const elShortNote = document.getElementById('shortNote' + idx) as HTMLInputElement;
         if (elShortNote !== null) {
           shortNoteContent = elShortNote.value;
         }
         let abstractOpen = '-';
         let theContent = '';
         if (GLB.saveContent) {
           let author_text = the_item.creator ? the_item.creator.trim() : '';
           if (author_text !== '') {
             author_text = '\n> ' + htmlToMarkdown(author_text);
           }
           let ctt = the_item.content ? the_item.content : ''; // Handle undefined content
           // Assuming helper functions are globally available or imported in main.ts
           theContent = remedyLatex(
                           htmlToMarkdown(unEscape(
                             handle_tags(
                             handle_a_tag(
                             handle_img_tag(
                             ctt.replace(/\n/g, ' '))))
                             .replace(/ +/g, ' ')
                             .replace(/\s+$/g, '')
                             .replace(/^\s+/g, '')))) + author_text;
         }
         if (! await this.app.vault.adapter.exists(fpath)) {
           await this.app.vault.create(fpath,
             shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' +
             the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") +
             '](' + sanitizeHTMLToDom(the_item.link).textContent + ')\n> ' + theContent);
           new Notice(fpath + " saved.", 1000);
         } else {
           new Notice(fpath + " already exists.", 1000);
         }
        return; // Handled
      }
      if (target.className === 'saveSnippet') {
        const idx = getNumFromId(target.id, 'saveSnippet');
         if (! await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
           await this.app.vault.createFolder(GLB.feeds_reader_dir);
         }
         const the_item = GLB.feedsStore[GLB.currentFeed].items[idx];
         const fpath: string = GLB.feeds_reader_dir + '/' + GLB.saved_snippets_fname;
         const link_text = sanitizeHTMLToDom(the_item.link).textContent || '';
         let shortNoteContent = '';
         const elShortNote = document.getElementById('shortNote' + idx) as HTMLInputElement;
         if (elShortNote !== null) {
           shortNoteContent = elShortNote.value;
         }
         let abstractOpen = '-';
         let dt_str: string = nowdatetime();
         if (the_item.pubDate != '') {
           dt_str = the_item.pubDate;
         } else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') {
           dt_str = GLB.feedsStore[GLB.currentFeed].pubDate;
         }
         if (dt_str !== '') {
           dt_str = '\n> <small>' + dt_str + '</small>';
         }
         let feedNameStr = GLB.currentFeedName;
         if (feedNameStr !== '') {
           feedNameStr = '\n> <small>' + feedNameStr + '</small>';
         }
         let theContent = '';
         if (GLB.saveContent) {
           let author_text = the_item.creator ? the_item.creator.trim() : '';
           if (author_text !== '') {
             author_text = '\n> ' + htmlToMarkdown(author_text);
           }
           let ctt = the_item.content ? the_item.content : ''; // Handle undefined content
           theContent = remedyLatex(
                           htmlToMarkdown(unEscape(
                             handle_tags(
                             handle_a_tag(
                             handle_img_tag(
                             ctt.replace(/\n/g, ' '))))
                             .replace(/ +/g, ' ')
                             .replace(/\s+$/g, '')
                             .replace(/^\s+/g, '')))) + author_text;
         }
         const snippet_content: string = (
             shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' +
             the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") +
             '](' + link_text + ')\n> ' + theContent + dt_str + feedNameStr);
         if (! await this.app.vault.adapter.exists(fpath)) {
           await this.app.vault.create(fpath, snippet_content);
           new Notice(fpath + " saved.", 1000);
         } else {
           const prevContent: string = (await this.app.vault.adapter.read(fpath)) || '';
           if (prevContent.includes(link_text)) {
             new Notice("Snippet url already exists.", 1000);
           } else {
             if (GLB.saveSnippetNewToOld) {
               await this.app.vault.process(this.app.vault.getAbstractFileByPath(fpath) as TFile,
                 (data) => {return snippet_content + '\n\n<hr>\n\n' + data;});
             } else {
               await this.app.vault.adapter.append(fpath,
                 '\n\n<hr>\n\n' + snippet_content);
             }
             new Notice("Snippet saved to " + fpath + ".", 1000);
           }
         }
        return; // Handled
      }

      // --- Handlers updated to use target.closest --- 
      // Restore the logic that was previously commented out, keeping target.closest
      if (target.closest('.toggleRead')) { 
          const toggleReadDiv = target.closest('.toggleRead') as HTMLElement;
          const idx = getNumFromId(toggleReadDiv.id, 'toggleRead'); 
          const toggleSpan = toggleReadDiv?.querySelector('span');
          if (toggleSpan) {
            GLB.feedsStoreChange = true;
            GLB.feedsStoreChangeList.add(GLB.currentFeed);
            if (GLB.feedsStore[GLB.currentFeed].items[idx].read === '') { // Currently unread
              GLB.feedsStore[GLB.currentFeed].items[idx].read = nowdatetime();
              setIcon(toggleSpan, 'check'); // Set icon to read
              toggleReadDiv.title = 'Mark as unread'; // Update title
              GLB.hideThisItem = true;
              if (GLB.elUnreadCount) {
                GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) - 1).toString();
              }
            } else { // Currently read
              GLB.feedsStore[GLB.currentFeed].items[idx].read = '';
              setIcon(toggleSpan, 'circle'); // Set icon to unread
              toggleReadDiv.title = 'Mark as read'; // Update title
              GLB.hideThisItem = false;
              if (!GLB.feedsStore[GLB.currentFeed].items[idx].deleted) {
                if (GLB.elUnreadCount) {
                  GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) + 1).toString();
                }
              }
            }
            const idxOf = GLB.undoList.indexOf(idx);
            if (idxOf > -1) {
              GLB.undoList.splice(idxOf, 1);
            }
            GLB.undoList.unshift(idx);
            if ((!GLB.showAll) && GLB.hideThisItem) {
              const el = document.getElementById(
                GLB.feedsStore[GLB.currentFeed].items[idx].link);
              if (el) el.className = 'hidedItem';
            }
          }
          return; // Handled
      }
      if (target.closest('.toggleDelete')) { 
          const toggleDeleteDiv = target.closest('.toggleDelete') as HTMLElement;
          const idx = getNumFromId(toggleDeleteDiv.id, 'toggleDelete');
          const toggleSpan = toggleDeleteDiv?.querySelector('span');
          if (toggleSpan) {
              GLB.feedsStoreChange = true;
              GLB.feedsStoreChangeList.add(GLB.currentFeed);
              if (GLB.feedsStore[GLB.currentFeed].items[idx].deleted === '') { // Currently not deleted
                  GLB.feedsStore[GLB.currentFeed].items[idx].deleted = nowdatetime();
                  setIcon(toggleSpan, 'history'); // Set icon to deleted (can be restored)
                  toggleDeleteDiv.title = 'Undelete'; // Update title
                  GLB.hideThisItem = true;
                  if (!GLB.feedsStore[GLB.currentFeed].items[idx].read) {
                  if (GLB.elUnreadCount) {
                      GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) - 1).toString();
                  }
                  }
              } else { // Currently deleted
                  GLB.feedsStore[GLB.currentFeed].items[idx].deleted = '';
                  setIcon(toggleSpan, 'trash-2'); // Set icon to not deleted
                  toggleDeleteDiv.title = 'Delete'; // Update title
                  GLB.hideThisItem = false;
                  if (!GLB.feedsStore[GLB.currentFeed].items[idx].read) {
                  if (GLB.elUnreadCount) {
                      GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) + 1).toString();
                  }
                  }
              }
              const idxOf = GLB.undoList.indexOf(idx);
              if (idxOf > -1) {
                  GLB.undoList.splice(idxOf, 1);
              }
              GLB.undoList.unshift(idx);
              if ((!GLB.showAll) && GLB.hideThisItem) {
                  const el = document.getElementById(
                  GLB.feedsStore[GLB.currentFeed].items[idx].link);
                  if (el) el.className = 'hidedItem';
              }
          }
          return; // Handled
      }
      if (target.closest('.jotNotes')) {
          const jotDiv = target.closest('.jotNotes') as HTMLElement;
          if (!jotDiv) return;
          const idx = getNumFromId(jotDiv.id, 'jotNotes');
           const el = document.getElementById('shortNoteContainer' + idx);
           if (el !== null) {
             return;
           }
           const elActionContainer = document.getElementById('actionContainer' + idx);
           if (elActionContainer === null) {
             return;
           }
           const shortNoteContainer = elActionContainer.createEl('div');
           const shortNote = shortNoteContainer.createEl('textarea');
           shortNoteContainer.id = 'shortNoteContainer' + idx;
           shortNote.className = 'shortNote';
           shortNote.id = 'shortNote' + idx;
           shortNote.rows = 2;
           shortNote.placeholder = 'Enter notes here to be saved in the markdown or the snippets file.';
          return; // Handled
      }
      if (target.closest('.saveSnippet')) {
          const saveSnippetDiv = target.closest('.saveSnippet') as HTMLElement;
          if (!saveSnippetDiv) return;
          const idx = getNumFromId(saveSnippetDiv.id, 'saveSnippet');
           if (! await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
             await this.app.vault.createFolder(GLB.feeds_reader_dir);
           }
           const the_item = GLB.feedsStore[GLB.currentFeed].items[idx];
           const fpath: string = GLB.feeds_reader_dir + '/' + GLB.saved_snippets_fname;
           const link_text = sanitizeHTMLToDom(the_item.link).textContent || '';
           let shortNoteContent = '';
           const elShortNote = document.getElementById('shortNote' + idx) as HTMLInputElement;
           if (elShortNote !== null) {
             shortNoteContent = elShortNote.value;
           }
           let abstractOpen = '-';
           let dt_str: string = nowdatetime();
           if (the_item.pubDate != '') {
             dt_str = the_item.pubDate;
           } else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') {
             dt_str = GLB.feedsStore[GLB.currentFeed].pubDate;
           }
           if (dt_str !== '') {
             dt_str = '\n> <small>' + dt_str + '</small>';
           }
           let feedNameStr = GLB.currentFeedName;
           if (feedNameStr !== '') {
             feedNameStr = '\n> <small>' + feedNameStr + '</small>';
           }
           let theContent = '';
           if (GLB.saveContent) {
             let author_text = the_item.creator ? the_item.creator.trim() : '';
             if (author_text !== '') {
               author_text = '\n> ' + htmlToMarkdown(author_text);
             }
             let ctt = the_item.content ? the_item.content : '';
             theContent = remedyLatex(
                             htmlToMarkdown(unEscape(
                               handle_tags(
                               handle_a_tag(
                               handle_img_tag(
                               ctt.replace(/\n/g, ' '))))
                               .replace(/ +/g, ' ')
                               .replace(/\s+$/g, '')
                               .replace(/^\s+/g, '')))) + author_text;
           }
           const snippet_content: string = (
               shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' +
               the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") +
               '](' + link_text + ')\n> ' + theContent + dt_str + feedNameStr);
           if (! await this.app.vault.adapter.exists(fpath)) {
             await this.app.vault.create(fpath, snippet_content);
             new Notice(fpath + " saved.", 1000);
           } else {
             const prevContent: string = (await this.app.vault.adapter.read(fpath)) || '';
             if (prevContent.includes(link_text)) {
               new Notice("Snippet url already exists.", 1000);
             } else {
               if (GLB.saveSnippetNewToOld) {
                 await this.app.vault.process(this.app.vault.getAbstractFileByPath(fpath) as TFile,
                   (data) => {return snippet_content + '\n\n<hr>\n\n' + data;});
               } else {
                 await this.app.vault.adapter.append(fpath,
                   '\n\n<hr>\n\n' + snippet_content);
               }
               new Notice("Snippet saved to " + fpath + ".", 1000);
             }
           }
          return; // Handled
      }
      if (target.closest('.noteThis')) {
          const noteThisDiv = target.closest('.noteThis') as HTMLElement;
          if (!noteThisDiv) return;
          const idx = getNumFromId(noteThisDiv.id, 'noteThis');
           if (! await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
             await this.app.vault.createFolder(GLB.feeds_reader_dir);
           }
           const the_item = GLB.feedsStore[GLB.currentFeed].items[idx];
           let dt_str: string = '';
           if (the_item.pubDate != '') {
             dt_str = the_item.pubDate;
           } else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') {
             dt_str = GLB.feedsStore[GLB.currentFeed].pubDate;
           } else {
             dt_str = nowdatetime();
           }
           dt_str = dt_str.substring(0, 10) + '-';
           const fname: string = dt_str +
                                 str2filename(
                                 (GLB.currentFeedName === ''? '' :
                                  GLB.currentFeedName.replace(/(\s+)/g, '-') + '-') +
                                 the_item.title.trim()
                                 .replace(/(<([^>]+)>)/g, " ")
                                 .replace(/[:!?@#\*\^\$]+/g, '')) + '.md';
           const fpath: string = GLB.feeds_reader_dir + '/' + fname;
           let shortNoteContent = '';
           const elShortNote = document.getElementById('shortNote' + idx) as HTMLInputElement;
           if (elShortNote !== null) {
             shortNoteContent = elShortNote.value;
           }
           let abstractOpen = '-';
           let theContent = '';
           if (GLB.saveContent) {
             let author_text = the_item.creator ? the_item.creator.trim() : '';
             if (author_text !== '') {
               author_text = '\n> ' + htmlToMarkdown(author_text);
             }
             let ctt = the_item.content ? the_item.content : '';
             theContent = remedyLatex(
                             htmlToMarkdown(unEscape(
                               handle_tags(
                               handle_a_tag(
                               handle_img_tag(
                               ctt.replace(/\n/g, ' '))))
                               .replace(/ +/g, ' ')
                               .replace(/\s+$/g, '')
                               .replace(/^\s+/g, '')))) + author_text;
           }
           if (! await this.app.vault.adapter.exists(fpath)) {
             await this.app.vault.create(fpath,
               shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' +
               the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") +
               '](' + sanitizeHTMLToDom(the_item.link).textContent + ')\n> ' + theContent);
             new Notice(fpath + " saved.", 1000);
           } else {
             new Notice(fpath + " already exists.", 1000);
           }
          return; // Handled
      }
      if (target.closest('.renderMath')) {
          const renderMathDiv = target.closest('.renderMath') as HTMLElement;
          if (!renderMathDiv) return;
          const idx = getNumFromId(renderMathDiv.id, 'renderMath');
           let elContent = document.getElementById('itemContent' + idx);
           const item = GLB.feedsStore[GLB.currentFeed].items[idx];
           if (item.content) {
               const elID = item.link;
               if (elContent !== null) {
                 elContent.empty();
               } else {
                 const itemEl = document.getElementById(elID);
                 if (!itemEl) {
                   new Notice('Failed to find element with ID: ' + elID, 1000);
                   return;
                 }
                 elContent = itemEl.createEl('div');
                 elContent.id = 'itemContent' + idx;
               }
               if(elContent) {
                 elContent.className = 'itemContent';
                 MarkdownRenderer.render(this.app,
                   remedyLatex(htmlToMarkdown(item.content)), elContent, item.link, this);
               }
             }
          return; // Handled
      }
      if (target.closest('.askChatGPT')) {
          const askChatGPTDiv = target.closest('.askChatGPT') as HTMLElement;
          if (!askChatGPTDiv) return;
          const idx = getNumFromId(askChatGPTDiv.id, 'askChatGPT');
           const item = GLB.feedsStore[GLB.currentFeed].items[idx];
           if (!item.content) {
             return;
           }
           const elID = item.link;
           const el = document.getElementById('shortNoteContainer' + idx);
           if (el === null) {
             const elActionContainer = document.getElementById('actionContainer' + idx);
             if (elActionContainer === null) {
               return;
             }
             const shortNoteContainer = elActionContainer.createEl('div');
             shortNoteContainer.id = 'shortNoteContainer' + idx;
             const shortNote = shortNoteContainer.createEl('textarea');
             shortNote.className = 'shortNote';
             shortNote.id = 'shortNote' + idx;
             shortNote.rows = 2;
             shortNote.placeholder = 'Waiting for ChatGPT to reply...';
           }
           const apiKey = this.settings.chatGPTAPIKey;
           const promptText = this.settings.chatGPTPrompt;
           try {
             let replyByGPT = await fetchChatGPT(apiKey, 0.0,
               promptText + '\n' + item.content);
             replyByGPT = replyByGPT.trim();
             if (replyByGPT !== '') {
               const shortNote = document.getElementById('shortNote' + idx) as HTMLTextAreaElement;
               let existingNote = shortNote.value;
               if (existingNote !== '') {
                 existingNote = existingNote + '\n\n';
               }
               shortNote.value = existingNote + replyByGPT;
             }
           } catch (e) {
             console.log(e);
           };
          return; // Handled
      }
      if (target.closest('.elEmbedButton')) {
          const embedDiv = target.closest('.elEmbedButton') as HTMLElement;
          if (!embedDiv) return;
          const idx = embedDiv.getAttribute('_idx');
           const elID = embedDiv.getAttribute('_link');
           if (document.getElementById('embeddedIframe' + idx) !== null) {
             return;
           }
           let elContent = document.getElementById('itemContent' + idx);
           if (elContent !== null) {
             elContent.empty();
           } else {
             const itemEl = document.getElementById(elID as string) as HTMLElement;
             if (!itemEl) {
               new Notice('Failed to find element with ID: ' + elID, 1000);
               return;
             }
             elContent = itemEl.createEl('div');
             elContent.className = 'itemContent';
             elContent.id = 'itemContent' + idx;
           }
           const url = embedDiv.getAttribute('url');
           if (elContent && url) { 
             const embeddedIframe = elContent.createEl('iframe');
             embeddedIframe.className = 'embeddedIframe';
             embeddedIframe.id = 'embeddedIframe' + idx;
             embeddedIframe.src = url as string;
           }
          return; // Handled
      }
      if (target.closest('.elFetch')) {
          const fetchDiv = target.closest('.elFetch') as HTMLElement;
          if (!fetchDiv) return;
          const idx = fetchDiv.getAttribute('_idx');
           const elID = fetchDiv.getAttribute('_link');
           const url = fetchDiv.getAttribute('url');
           if (!url) {
             new Notice('Failed to get URL for fetching.', 1000);
             return;
           }
           if (document.getElementById('fetchContainer' + idx) !== null) {
             return;
           }
           let pageSrc: string | null = null;
           try {
             const response = await request({url: url, method: "GET"});
             if (response === null) {
               new Notice('Fail to fetch ' + url, 1000);
               return;
             }
             pageSrc = response;
           } catch (e) {
             new Notice('Fail to fetch ' + url, 1000);
             return;
           }
           let elContent = document.getElementById('itemContent' + idx);
           if (elContent !== null) {
             elContent.empty();
           } else {
             const itemEl = document.getElementById(elID as string);
             if (itemEl === null) return;
             elContent = itemEl.createEl('div');
             elContent.className = 'itemContent';
             elContent.id = 'itemContent' + idx;
           }
           if(elContent && pageSrc) { 
             const fetchContainer = elContent.createEl('div');
             fetchContainer.className = 'fetchContainer';
             fetchContainer.id = 'fetchContainer' + idx;
             fetchContainer.appendChild(sanitizeHTMLToDom(pageSrc));
           }
          return; // Handled
      }

      // Fallback/other handlers (e.g., markPageRead/Deleted)
      if ((target.className === 'markPageRead') ||
          (target.className === 'markPageDeleted')) {
        if (!GLB.feedsStore.hasOwnProperty(GLB.currentFeed)) {
          return;
        }
        const fd = GLB.feedsStore[GLB.currentFeed];
        const nowStr = nowdatetime();
        let changed = false;
        let nMarked = 0;

        for (let i=GLB.idxItemStart;
             i<Math.min(GLB.displayIndices.length, GLB.idxItemStart+GLB.nItemPerPage);
             i++) {
          const idx = GLB.displayIndices[i];
          const item = fd.items[idx];
          if ((item.read) || (item.deleted)) {
            continue;
          }
          changed = true;
          nMarked += 1;
          if (target.className === 'markPageRead') {
            item.read = nowStr;
            const elToggleRead = document.getElementById('toggleRead' + idx);
            if (elToggleRead) {
              elToggleRead.innerText = 'Unread';
            }
          } else {
            item.deleted = nowStr;
            const elToggleDeleted = document.getElementById('toggleDelete' + idx);
            if (elToggleDeleted) {
              elToggleDeleted.innerText = 'Undelete';
            }
          }

          const idxOf = GLB.undoList.indexOf(idx);
          if (idxOf > -1) {
            GLB.undoList.splice(idxOf, 1);
          }
          GLB.undoList.unshift(idx);

          GLB.hideThisItem = true;
          if ((!GLB.showAll) && GLB.hideThisItem) {
            const el = document.getElementById(
              GLB.feedsStore[GLB.currentFeed].items[idx].link);
            if (el) el.className = 'hidedItem';
          }
        }
        if (changed) {
          GLB.feedsStoreChange = true;
          GLB.feedsStoreChangeList.add(GLB.currentFeed);
          if (GLB.elUnreadCount) {
            GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) - nMarked).toString();
          }
          if (!GLB.showAll) {
            Array.from(document.getElementsByClassName('pageActions')).forEach(el => {el.remove();});
            if (GLB.idxItemStart+GLB.nItemPerPage < GLB.displayIndices.length) {
              GLB.idxItemStart += GLB.nItemPerPage;
              GLB.nPage += 1;
              show_feed();
            } else {
              GLB.idxItemStart = 0;
              GLB.nPage = 1;
              makeDisplayList();
              show_feed();
            }
          }
        }
      }
      if (target.className === 'removePageContent') {
        if (!GLB.feedsStore.hasOwnProperty(GLB.currentFeed)) {
          return;
        }
        const fd = GLB.feedsStore[GLB.currentFeed];
        let changed = false;
        let nMarked = 0;

        for (let i=GLB.idxItemStart;
             i<Math.min(GLB.displayIndices.length, GLB.idxItemStart+GLB.nItemPerPage);
             i++) {
          const idx = GLB.displayIndices[i];
          const item = fd.items[idx];
          if (item.read) {
            continue;
          }
          changed = true;
          nMarked += 1;
          if (item.content) {
            delete item.content;
          }
          if (item.creator) {
            delete item.creator;
          }
        }
        if (changed) {
          GLB.feedsStoreChange = true;
          GLB.feedsStoreChangeList.add(GLB.currentFeed);
          show_feed();
        }
      }
    });

		// this.registerInterval(window.setInterval(async () => await saveFeedsData(), 5 * 60 * 1000));
	}

	async onunload() {
    await saveFeedsData();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_FEEDS_READER);
	}

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER);
    let leaf: WorkspaceLeaf | null = null;

    if (leaves?.length > 0) {
        leaf = leaves[0];
    }
    if (!leaf) {
        leaf = this.app.workspace.getLeaf(false);
    }
    if (!leaf) {
        leaf = this.app.workspace.activeLeaf;
    }

    if (leaf) {
      await leaf.setViewState({
        type: VIEW_TYPE_FEEDS_READER,
        active: true
      });
    }

    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER)[0]
    );

    if (GLB.currentFeed != '') {
      show_feed();
    }
  }

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    GLB.nItemPerPage = this.settings.nItemPerPage;
    GLB.saveContent = this.settings.saveContent;
    GLB.saveSnippetNewToOld = this.settings.saveSnippetNewToOld;

    GLB.feeds_reader_dir = 'feeds-reader';
    GLB.feeds_data_fname = 'feeds-data.json';
    GLB.feeds_store_base = 'feeds-store';
    GLB.saved_snippets_fname = 'snippets.md';
    GLB.subscriptions_fname = 'subscriptions.json';
    GLB.showAll = false;
    GLB.titleOnly = true;
    GLB.itemOrder = 'New to old';
    GLB.currentFeed = '';
    GLB.currentFeedName = '';
    GLB.nMergeLookback = 100000;
    GLB.lenStrPerFile = 1024 * 1024;
    GLB.feedsStoreChange = false;
    GLB.feedsStoreChangeList = new Set<string>();
    GLB.elUnreadCount = undefined;
    GLB.maxTotalnumDisplayed = 1e5;
    GLB.nThanksSep = 16;

    GLB.settings = this.settings;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

  close() {
    // モーダルを閉じる処理
    this.app.workspace.activeLeaf?.detach();
  }
}

function mergeStoreWithNewData(newdata: RssFeedContent, key: string) {
  if (!GLB.feedsStore.hasOwnProperty(key)) {
    GLB.feedsStore[key] = newdata;
    GLB.feedsStoreChange = true;
    GLB.feedsStoreChangeList.add(key);
    return newdata.items.length;
  }
  GLB.feedsStore[key].title = newdata.title;
  GLB.feedsStore[key].subtitle = newdata.subtitle;
  GLB.feedsStore[key].description = newdata.description;
  GLB.feedsStore[key].pubDate = newdata.pubDate;
  let nNew = 0;
  const nLookback = Math.min(GLB.nMergeLookback, GLB.feedsStore[key].items.length);
  for (let j=newdata.items.length-1; j>=0; j--) {
    let found = false;
    for (let i=0; i<nLookback; i++) {
      if (GLB.feedsStore[key].items[i].link === newdata.items[j].link) {
        found = true;
        break;
      }
    }
    if (!found) {
      nNew += 1;
      GLB.feedsStore[key].items.unshift(newdata.items[j]);
      GLB.feedsStoreChange = true;
      GLB.feedsStoreChangeList.add(key);
    }
  }
  return nNew;
}

async function updateOneFeed(fdUrl: string) {
  let nNew = 0;
  const res = await getFeedItems(fdUrl);
  if ((res != undefined) && (res.items != undefined)) {
    nNew = mergeStoreWithNewData(res, fdUrl);
    if (nNew > 0) {
      const stats = getFeedStats(fdUrl);
      const unreadCountEl = document.getElementById('unreadCount' + fdUrl);
      if (unreadCountEl) {
        unreadCountEl.innerText = stats.unread.toString();
      }
      if (fdUrl === GLB.currentFeed) {
        if (GLB.elUnreadCount) {
          GLB.elUnreadCount.innerText = stats.unread.toString();
        }
        GLB.undoList = [];
        GLB.idxItemStart = 0;
        GLB.nPage = 1;
        makeDisplayList();
        show_feed();
      }
      if (stats.total < GLB.maxTotalnumDisplayed) {
        const totalCountEl = document.getElementById('totalCount' + fdUrl);
        if (totalCountEl) {
          totalCountEl.innerText = stats.total.toString();
        }
      }
      await saveFeedsData();
    }
    return [nNew, res.items.length];
  } else {
    return [0, 0];
  }
}


class SearchModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
    this.titleEl.innerText = "Search";
    const form = contentEl.createEl('table');
    form.className = "searchForm";
    const colgroup = form.createEl('colgroup');
    colgroup.createEl('col').className = 'searchCol1';
    colgroup.createEl('col').className = 'searchCol2';
    const tr = form.createEl('tr');
    tr.createEl('td', {text: 'Search terms'});
    const inputBox = tr.createEl('td').createEl('input');
    inputBox.id = 'searchTerms';
    inputBox.className = 'searchTerms';
    const trWordwise = form.createEl('tr');
    trWordwise.createEl('td', {text: "Wordwise"});
    const checkBoxWordwise = trWordwise.createEl('td').createEl('input');
    checkBoxWordwise.id = 'checkBoxWordwise';
    checkBoxWordwise.type = 'checkBox';
    const searchButton = form.createEl('tr').createEl('td').createEl('button', {text: "Search"});
    searchButton.addEventListener("click", async () => {
      const wordWise = (document.getElementById('checkBoxWordwise') as HTMLInputElement).checked;
      const searchTerms = ([...new Set((document.getElementById('searchTerms') as HTMLInputElement).value.toLowerCase().split(/[ ,;\t\n]+/))]
                         .filter(i => i)
                         .sort((a: string, b: string) => b.length - a.length)) as string[];
      if (searchTerms.length === 0) {
        return;
      }
      const fd = GLB.feedsStore[GLB.currentFeed].items;
      const sep = /\s+/;
      GLB.displayIndices = [];
      for (let i=0; i<fd.length; i++) {
        let item = fd[i];
        let sItems;
        let sCreator='', sContent='';
        if (item.creator) {
          sCreator = item.creator;
        }
        if (item.content) {
          sContent = item.content;
        }
        if (wordWise) {
          sItems = (item.title.toLowerCase().split(sep)
              .concat(sCreator.toLowerCase().split(sep))
              .concat(sContent.toLowerCase().split(sep)));
        } else {
          sItems = [item.title.toLowerCase(), sCreator.toLowerCase(),
                    sContent.toLowerCase()].join(' ');
        }
        let found = true;
        for (let j=0; j<searchTerms.length; j++) {
          if (!sItems.includes(searchTerms[j])) {
            found = false;
            break;
          }
        }
        if (found) {
          GLB.displayIndices.push(i);
        }
      }
      show_feed();
      this.close();
    });
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class AddFeedModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
    this.titleEl.innerText = "Add feed";
    const form = contentEl.createEl('table');
    form.className = 'addFeedTable';
    const colgroup = form.createEl('colgroup');
    colgroup.createEl('col').className = 'addFeedCol1';
    colgroup.createEl('col').className = 'addFeedCol2';
    let tr = form.createEl('tr');
    tr.createEl('td', {text: "Name"});
    const tdnewFeedName = tr.createEl('td').createEl('input');
    tdnewFeedName.className = 'addFeedInput';
    tdnewFeedName.id = 'newFeedName';
    tr = form.createEl('tr');
    tr.createEl('td', {text: "URL"});
    const tdnewFeedUrl = tr.createEl('td').createEl('input');
    tdnewFeedUrl.className = 'addFeedInput';
    tdnewFeedUrl.id = 'newFeedUrl';
    tr = form.createEl('tr');
    tr.createEl('td', {text: "Folder"});
    const tdnewFeedFolder = tr.createEl('td').createEl('input');
    tdnewFeedFolder.id = 'newFeedFolder';
    tdnewFeedFolder.className = 'addFeedInput';
    tr = form.createEl('tr');
    const saveButton = tr.createEl('td').createEl('button', {text: "Save"});
    saveButton.addEventListener("click", async () => {
      const newFeedName = (document.getElementById('newFeedName') as HTMLInputElement).value;
      const newFeedUrl = (document.getElementById('newFeedUrl') as HTMLInputElement).value;
      const newFeedFolder = (document.getElementById('newFeedFolder') as HTMLInputElement).value;
      if ((newFeedName == "") || (newFeedUrl == "")) {
        new Notice("Feed name and url must not be empty.", 1000);
        return;
      }
      for (let i=0; i<GLB.feedList.length; i++) {
        if (GLB.feedList[i].feedUrl == newFeedUrl) {
          new Notice("Not added: url already included.", 1000);
          return;
        }
        if (GLB.feedList[i].name == newFeedName) {
          new Notice("Not added: name already used.", 1000);
          return;
        }
      }
      GLB.feedList.push({
        name: newFeedName,
        feedUrl: newFeedUrl,
        folder: newFeedFolder,
        unread: 0,
        updated: 0
      });
      sort_feed_list();
      await saveSubscriptions();
      await createFeedBar();
    });
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}


class ManageFeedsModal extends Modal {
	constructor(app: App) {
		super(app);
	}
	asc: boolean = false;

	onOpen() {
		const {contentEl} = this;
    this.titleEl.innerText = "Manage feeds";
    contentEl.appendChild(sanitizeHTMLToDom('<div><b>CAUTION:</b><br>All actions take effect immediately and cannot be undone!<br>N: name; U: url; F: folder; T: total number of items; R: number of items marked as read; D: number of items marked as deleted; A: average length of items; S: storage size.</div><hr>'));

    const actions = contentEl.createEl('div');

    const btApplyChanges = actions.createEl('button', {text: 'Modify N/U/F'});
    const btMarkAllRead = actions.createEl('button', {text: 'Mark all read'});
    const btPurgeDeleted = actions.createEl('button', {text: 'Purge deleted'});
    const btRemoveContent = actions.createEl('button', {text: 'Remove content'});
    const btRemoveEmptyFields = actions.createEl('button', {text: 'Remove empty fields'});
    const btRemoveContentOld = actions.createEl('button', {text: 'Remove old content'});
    const btPurgeAll = actions.createEl('button', {text: 'Purge all'});
    const btPurgeOldHalf = actions.createEl('button', {text: 'Purge old'});
    const btDeduplicate = actions.createEl('button', {text: 'Deduplicate'});
    const btRemoveFeed = actions.createEl('button', {text: 'Remove feed'});

    btApplyChanges.addEventListener('click', async () => {
      let changed = false;
      for (let i=0; i<GLB.feedList.length; i++) {
        const newName = (document.getElementById('manageFdName' + i.toString()) as HTMLInputElement).value;
        const newUrl = (document.getElementById('manageFdUrl' + i.toString()) as HTMLInputElement).value;
        const newFolder = (document.getElementById('manageFdFolder' + i.toString()) as HTMLInputElement).value;
        let sMsg = '';
        if (GLB.feedList[i].name != newName) {
          sMsg += 'Name: ' + GLB.feedList[i].name + ' -> ' + newName;
        }
        if (GLB.feedList[i].feedUrl != newUrl) {
          sMsg += '\nUrl: ' + GLB.feedList[i].feedUrl + ' -> ' + newUrl;
        }
        if (GLB.feedList[i].folder != newFolder) {
          sMsg += '\nFolder: ' + GLB.feedList[i].folder + ' -> ' + newFolder;
        }
        if (sMsg !== '') {
          if (window.confirm("Apply changes for " + GLB.feedList[i].name + '?\n' + sMsg)) {
            changed = true;
            if (GLB.feedList[i].name != newName) {
              let alreadyIncluded = false;
              for (let j=0; j<GLB.feedList.length; j++) {
                if ((j != i) && (GLB.feedList[j].name === newName)) {
                  new Notice("Not changed: name already included.", 1000);
                  alreadyIncluded = true;
                  break;
                }
              }
              if (!alreadyIncluded) {
                for (let j=0;;j++) {
                  const fpath_old = [GLB.feeds_reader_dir, GLB.feeds_store_base,
                                   makeFilename(GLB.feedList[i].name, j)+'.gzip'].join('/');
                  const fpath_new = [GLB.feeds_reader_dir, GLB.feeds_store_base,
                                   makeFilename(newName, j)+'.gzip'].join('/');
                  if (await this.app.vault.adapter.exists(fpath_old)) {
                    await this.app.vault.adapter.rename(fpath_old, fpath_new);
                  } else {
                    break;
                  }
                }
                if (GLB.currentFeedName === GLB.feedList[i].name) {
                  GLB.currentFeedName = newName;
                }
                GLB.feedList[i].name = newName;
              }
            }
            if (GLB.feedList[i].feedUrl != newUrl) {
              let alreadyIncluded = false;
              for (let j=0; j<GLB.feedList.length; j++) {
                if ((j != i) && (GLB.feedList[j].feedUrl === newUrl)) {
                  new Notice("Not changed: url already included.", 1000);
                  alreadyIncluded = true;
                  break;
                }
              }
              if (!alreadyIncluded) {
                if (GLB.currentFeed === GLB.feedList[i].feedUrl) {
                  GLB.currentFeed = newUrl;
                }
                GLB.feedsStore[newUrl] = GLB.feedsStore[GLB.feedList[i].feedUrl];
                delete GLB.feedsStore[GLB.feedList[i].feedUrl];
                GLB.feedList[i].feedUrl = newUrl;
              }
            }
            if (GLB.feedList[i].folder != newFolder) {
              GLB.feedList[i].folder = newFolder;
            }
          }
        }
      }
      if (changed) {
        sort_feed_list();
        await saveSubscriptions();
        await createFeedBar();
        this.close();
      }
    });
    btMarkAllRead.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
        Array.from(document.getElementsByClassName('checkThis'))
        .filter(el => (el as HTMLInputElement).checked)
        .forEach(el => {markAllRead(el.getAttribute('val')!);});}});
    btPurgeDeleted.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {purgeDeleted(el.getAttribute('val')!);});}});
    btRemoveContent.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {removeContent(el.getAttribute('val')!);});}});
    btRemoveEmptyFields.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {removeEmptyFields(el.getAttribute('val')!);});}});
    btRemoveContentOld.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {removeContentOld(el.getAttribute('val')!);});}});
    btPurgeAll.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {purgeAll(el.getAttribute('val')!);});}});
    btPurgeOldHalf.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {purgeOldHalf(el.getAttribute('val')!);});}});
    btDeduplicate.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {const nRemoved = deduplicate(el.getAttribute('val')!);
                      if (nRemoved>0) {
                        new Notice(nRemoved + " removed for "
                        + el.getAttribute('fdName'), 2000);
                      }});}});
    btRemoveFeed.addEventListener('click', () => {
      if (window.confirm('Sure?')) {
      Array.from(document.getElementsByClassName('checkThis'))
      .filter(el => (el as HTMLInputElement).checked)
      .forEach(el => {removeFeed(el.getAttribute('val')!);});}});

    contentEl.createEl('br');

    const formContainer = contentEl.createEl('div');
    const form = formContainer.createEl('table');
    form.className = 'manageFeedsForm';
    let tr;
    tr = form.createEl('thead').createEl('tr');
    tr.createEl('th', {text: "N/U"});
    tr.createEl('th', {text: "F"});
    tr.createEl('th', {text: "T"});
    tr.createEl('th', {text: "R"});
    tr.createEl('th', {text: "D"});
    tr.createEl('th', {text: "A"});
    tr.createEl('th', {text: "S"});
    const checkAll = tr.createEl('th').createEl('input');
    checkAll.type = 'checkBox';
    checkAll.id = 'checkAll';
    checkAll.addEventListener('click', (evt) => {
      if ((document.getElementById('checkAll') as HTMLInputElement).checked) {
        Array.from(document.getElementsByClassName('checkThis')).forEach(el => {(el as HTMLInputElement).checked = true;});
      } else {
        Array.from(document.getElementsByClassName('checkThis')).forEach(el => {(el as HTMLInputElement).checked = false;});
      }
    });

    const tbody = form.createEl('tbody');
    let nTotal=0, nRead=0, nDeleted=0, nLength=0, nStoreSize=0;
    for (let i=0; i<GLB.feedList.length; i++) {
      tr = tbody.createEl('tr');
      const cellNameContainer = tr.createEl('td');
      cellNameContainer.className = 'cellNameContainer';
      const elName = cellNameContainer.createEl('input', {value: GLB.feedList[i].name});
      elName.readOnly = false;
      elName.id = 'manageFdName' + i.toString();
      const elUrl = cellNameContainer.createEl('input', {value: GLB.feedList[i].feedUrl});
      elUrl.readOnly = false;
      elUrl.id = 'manageFdUrl' + i.toString();
      const cellFolderContainer = tr.createEl('td');
      cellFolderContainer.className = 'cellFolderContainer';
      const elFolder = cellFolderContainer.createEl('input', {value: GLB.feedList[i].folder});
      elFolder.readOnly = false;
      elFolder.id = 'manageFdFolder' + i.toString();

      const stats = getFeedStats(GLB.feedList[i].feedUrl);
      const storeSizeInfo = getFeedStorageInfo(GLB.feedList[i].feedUrl);
      tr.createEl('td', {text: stats.total.toString()}).setAttribute('sortBy', stats.total.toString());
      tr.createEl('td', {text: stats.read.toString()}).setAttribute('sortBy', stats.read.toString());
      tr.createEl('td', {text: stats.deleted.toString()}).setAttribute('sortBy', stats.deleted.toString());
      tr.createEl('td', {text: storeSizeInfo[0].toString()}).setAttribute('sortBy', (Number(storeSizeInfo[2])/Number(stats.total)).toString());
      tr.createEl('td', {text: storeSizeInfo[1].toString()}).setAttribute('sortBy', storeSizeInfo[3].toString());
      const checkThis = tr.createEl('td').createEl('input');
      checkThis.type = 'checkBox';
      checkThis.className = 'checkThis';
      checkThis.setAttribute('val', GLB.feedList[i].feedUrl);
      checkThis.setAttribute('fdName', GLB.feedList[i].name);

      nTotal += stats.total;
      nRead += stats.read;
      nDeleted += stats.deleted;
      nLength += Number(storeSizeInfo[2]);
      nStoreSize += Number(storeSizeInfo[3]);
    }
    tr = tbody.createEl('tr');
    tr.createEl('td', {text: 'Total: ' + GLB.feedList.length.toString()});
    tr.createEl('td');
    tr.createEl('td', {text: nTotal.toString()});
    tr.createEl('td', {text: nRead.toString()});
    tr.createEl('td', {text: nDeleted.toString()});
    tr.createEl('td', {text: Math.floor(nLength/nTotal).toString()});
    tr.createEl('td', {text: getStoreSizeStr(nStoreSize)});
    tr.createEl('td');

    // From: https://stackoverflow.com/questions/14267781/sorting-html-table-with-javascript
    // https://stackoverflow.com/questions/14267781/sorting-html-table-with-javascript/53880407#53880407
    const getCellValue = (tr: HTMLElement, idx: number): string => {
      const val = tr.children[idx].getAttribute('sortBy') || (tr.children[idx].firstChild as HTMLInputElement)?.value;
      return val?.toString() || '0';
    };
    
    const comparer = ((idx: number, asc: boolean) =>
      (a: HTMLElement, b: HTMLElement) =>
        ((v1: string, v2: string) =>
         v1 !== '' && v2 !== '' && !isNaN(Number(v1)) && !isNaN(Number(v2)) ? 
         Number(v1) - Number(v2) : 
         v1.toString().localeCompare(v2)
        )(getCellValue(asc ? a : b, idx), getCellValue(asc ? b : a, idx)));
    
    const rowSelectorStr ='tr:nth-child(-n+' + (GLB.feedList.length).toString() + ')';
    document.querySelectorAll('.manageFeedsForm th:nth-child(n+1):nth-child(-n+7)')
    .forEach(th => th.addEventListener('click', (() => {
        const table = th.closest('table');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const parentNode = th.parentNode;
        if (!parentNode) return;
        Array.from(tbody.querySelectorAll(rowSelectorStr))
            .sort(comparer(Array.from(parentNode.children).indexOf(th), this.asc = !this.asc))
            .forEach(tr => tbody.insertBefore(tr, tbody.lastChild));
    })));

	}

	async onClose() {
		const {contentEl} = this;
    if (GLB.feedsStoreChange) {
      await createFeedBar();
    }
		contentEl.empty();
	}
}


class FeedReaderSettingTab extends PluginSettingTab {
	plugin: FeedsReader;

	constructor(app: App, plugin: FeedsReader) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for RSS Feed Reader'});

		containerEl.createEl('h3', {text: 'ChatGPT'});
		new Setting(containerEl)
			.setName('ChatGPT API Key')
			.setDesc('Enter the API Key for ChatGPT')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.chatGPTAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.chatGPTAPIKey = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('ChatGPT Prompt')
			.setDesc('Prompt text for ChatGPT')
			.addTextArea(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.chatGPTPrompt)
				.onChange(async (value) => {
					this.plugin.settings.chatGPTPrompt = value;
					await this.plugin.saveSettings();
				}));
		containerEl.createEl('h3', {text: 'Appearance'});
		new Setting(containerEl)
			.setName('Items per page')
			.setDesc('Number of items to display per page')
			.addText(text => text
				.setPlaceholder('')
				.setValue(this.plugin.settings.nItemPerPage.toString())
				.onChange(async (value) => {
          GLB.nItemPerPage = parseInt(value);
					this.plugin.settings.nItemPerPage = GLB.nItemPerPage;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Show Jot')
			.setDesc('Whether to show jot button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showJot)
			   .onChange(async (value) => {
            GLB.settings.showJot = value;
			  		this.plugin.settings.showJot = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Snippet')
			.setDesc('Whether to show snippet button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showSnippet)
			   .onChange(async (value) => {
            GLB.settings.showSnippet = value;
			  		this.plugin.settings.showSnippet = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Read')
			.setDesc('Whether to show read button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showRead)
			   .onChange(async (value) => {
            GLB.settings.showRead = value;
			  		this.plugin.settings.showRead = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Save')
			.setDesc('Whether to show save button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showSave)
			   .onChange(async (value) => {
            GLB.settings.showSave = value;
			  		this.plugin.settings.showSave = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Math')
			.setDesc('Whether to show math button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showMath)
			   .onChange(async (value) => {
            GLB.settings.showMath = value;
			  		this.plugin.settings.showMath = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show GPT')
			.setDesc('Whether to show GPT button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showGPT)
			   .onChange(async (value) => {
            GLB.settings.showGPT = value;
			  		this.plugin.settings.showGPT = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Embed')
			.setDesc('Whether to show Embed button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showEmbed)
			   .onChange(async (value) => {
            GLB.settings.showEmbed = value;
			  		this.plugin.settings.showEmbed = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Fetch')
			.setDesc('Whether to show Fetch button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showFetch)
			   .onChange(async (value) => {
            GLB.settings.showFetch = value;
			  		this.plugin.settings.showFetch = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Link')
			.setDesc('Whether to show Link button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showLink)
			   .onChange(async (value) => {
            GLB.settings.showLink = value;
			  		this.plugin.settings.showLink = value;
			  		await this.plugin.saveSettings();
			  	}));
		new Setting(containerEl)
			.setName('Show Delete')
			.setDesc('Whether to show Delete button')
      .addToggle(t =>
        t.setValue(this.plugin.settings.showDelete)
			   .onChange(async (value) => {
            GLB.settings.showDelete = value;
			  		this.plugin.settings.showDelete = value;
			  		await this.plugin.saveSettings();
			  	}));
		containerEl.createEl('h3', {text: 'Saving'});
		new Setting(containerEl)
			.setName('Include content')
			.setDesc('Whether to include the content when saving')
			.addToggle(text => text
				.setValue(this.plugin.settings.saveContent)
				.onChange(async (value) => {
          GLB.saveContent = value;
					this.plugin.settings.saveContent = GLB.saveContent;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Snippets saved from new to old')
			.setDesc('New to old / old to new')
			.addToggle(text => text
				.setValue(this.plugin.settings.saveSnippetNewToOld)
				.onChange(async (value) => {
          GLB.saveSnippetNewToOld = value;
					this.plugin.settings.saveSnippetNewToOld = GLB.saveSnippetNewToOld;
					await this.plugin.saveSettings();
				}));
	}
}

export async function saveFeedsData () {
  let nSaved = 0;
  if (!GLB.feedsStoreChange) {
    return nSaved;
  }
  for (let i=0; i<GLB.feedList.length; i++) {
    let key = GLB.feedList[i].feedUrl;
    if (!GLB.feedsStoreChangeList.has(key)) {
      continue;
    }
    if (!GLB.feedsStore.hasOwnProperty(key)) {
      continue;
    }
    nSaved += (await saveStringSplitted(JSON.stringify(GLB.feedsStore[key], null, 0),
                GLB.feeds_reader_dir + '/' + GLB.feeds_store_base,
                GLB.feedList[i].name,
                GLB.lenStrPerFile));
  }

  GLB.feedsStoreChange = false;
  GLB.feedsStoreChangeList.clear();
  return nSaved;
}

export async function loadFeedsStoredData() {
  let noSplitFile = true;
  GLB.feedsStore = {};
  for (let i=0; i<GLB.feedList.length; i++) {
    let res = await loadStringSplitted_Gzip(GLB.feeds_reader_dir + '/' + GLB.feeds_store_base, GLB.feedList[i].name);
    if (res === '') {
      res = await loadStringSplitted(GLB.feeds_reader_dir + '/' + GLB.feeds_store_base, GLB.feedList[i].name);
      // Convert non-gzip files to gzip files.
      if (res !== '') {
        GLB.feedsStoreChange = true;
        GLB.feedsStoreChangeList.add(GLB.feedList[i].feedUrl);
      }
    }
    if (res.length > 0) {
      try {
        GLB.feedsStore[GLB.feedList[i].feedUrl] = JSON.parse(res);
        noSplitFile = false;
      } catch (e) {
        console.log(e);
        console.log(GLB.feedList[i].feedUrl);
      }
    }
  }
  if (noSplitFile) {
    if (! await this.app.vault.exists(GLB.feeds_reader_dir)) {
      await this.app.vault.createFolder(GLB.feeds_reader_dir);
    }
    const fpath = GLB.feeds_reader_dir+'/'+GLB.feeds_data_fname;
    if (await this.app.vault.exists(fpath)) {
      GLB.feedsStore = JSON.parse(await this.app.vault.adapter.read(fpath));
    }
  }
}

function str2filename(s: string) {
  const illegalRe = /[\/\?<>\\:\*\|"]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const windowsTrailingRe = /[\. ]+$/;
  const replacement = ' ';
  s = unEscape(s);
  return s.replace(illegalRe, replacement)
          .replace(controlRe, replacement)
          .replace(reservedRe, replacement)
          .replace(windowsReservedRe, replacement)
          .replace(windowsTrailingRe, replacement)
          .replace(/[\[\]]/g, '')
          .replace(/[_-]\s+/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .replace(/[_-]*\s+$/g, '');
}

function unEscape(htmlStr: string) {
    return htmlStr.replace(/&lt;/g , "<")
                  .replace(/&gt;/g , ">")
                  .replace(/&quot;/g , "\"")
                  .replace(/&#39;/g , "\'")
                  .replace(/&amp;/g , "&")
                  .replace(/&nbsp;/g , " ");
}

export function getFeedStats(feedUrl: string) {
  if (!GLB.feedsStore.hasOwnProperty(feedUrl)) {
    return {total: 0, read: 0, deleted: 0, unread: 0};
  }
  const fd = GLB.feedsStore[feedUrl];
  let nRead = 0, nDeleted = 0, nUnread = 0, nTotal = fd.items.length;
  for (let i=0; i<nTotal; i++) {
    if (fd.items[i].read) {
      nRead += 1;
    }
    if (fd.items[i].deleted) {
      nDeleted += 1;
    }
    if ((!fd.items[i].read) && (!fd.items[i].deleted)) {
      nUnread += 1;
    }
  }
  return {total: nTotal, read: nRead, deleted: nDeleted, unread: nUnread};
}


export function getFeedStorageInfo(feedUrl: string) {
  if (!GLB.feedsStore.hasOwnProperty(feedUrl)) {
    return ['0', '0', 0, 0];
  }
  if (GLB.feedsStore[feedUrl].items.length == 0) {
    return ['0', '0', 0, 0];
  }
  const s = JSON.stringify(GLB.feedsStore[feedUrl], null, 1);
  const sz = (new Blob([s])).size;
  const szstr = getStoreSizeStr(sz);
  return [Math.floor(s.length/GLB.feedsStore[feedUrl].items.length).toString(), szstr, s.length, sz];
}

function getStoreSizeStr(sz: number) {
  let szstr = '';
  if (sz <= 1e3) {
    szstr = sz.toString() + 'B';
  } else if (sz <= 1e6) {
    szstr = (sz/1e3).toFixed(1) + 'kB';
  } else if (sz <= 1e9) {
    szstr = (sz/1e6).toFixed(1) + 'MB';
  } else if (sz <= 1e12) {
    szstr = (sz/1e9).toFixed(1) + 'GB';
  } else {
    szstr = (sz/1e12).toFixed(1) + 'TB';
  }
  return szstr;
}


function markAllRead(feedUrl: string) {
  const nowStr = nowdatetime();
  for (let i=0; i<GLB.feedsStore[feedUrl].items.length; i++) {
    if (!GLB.feedsStore[feedUrl].items[i].read) {
      GLB.feedsStore[feedUrl].items[i].read = nowStr;
    }
  }
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function purgeDeleted(feedUrl: string) {
  GLB.feedsStore[feedUrl].items = GLB.feedsStore[feedUrl].items.filter(
    item => !item.deleted);
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function removeContent(feedUrl: string) {
  for (let i=0; i<GLB.feedsStore[feedUrl].items.length; i++) {
    delete GLB.feedsStore[feedUrl].items[i].content;
    delete GLB.feedsStore[feedUrl].items[i].creator;
  }
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function removeEmptyFields(feedUrl: string) {
  for (let i=0; i<GLB.feedsStore[feedUrl].items.length; i++) {
    for (const [key, value] of Object.entries(GLB.feedsStore[feedUrl].items[i])) {
      if (value === '') {
        delete GLB.feedsStore[feedUrl].items[i][key];
      }
    }
  }
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function removeContentOld(feedUrl: string) {
  let iDel = Math.floor(GLB.feedsStore[feedUrl].items.length / 3);
  iDel = Math.min(iDel, 200);
  for (let i=iDel; i<GLB.feedsStore[feedUrl].items.length; i++) {
    GLB.feedsStore[feedUrl].items[i].content = '';
    GLB.feedsStore[feedUrl].items[i].creator = '';
  }
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function purgeAll(feedUrl: string) {
  GLB.feedsStore[feedUrl].items.length = 0;
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function purgeOldHalf(feedUrl: string) {
  const iDel = Math.floor(GLB.feedsStore[feedUrl].items.length / 2);
  GLB.feedsStore[feedUrl].items.splice(iDel);
  GLB.feedsStoreChange = true;
  GLB.feedsStoreChangeList.add(feedUrl);
}

function deduplicate(feedUrl: string) {
  const n = GLB.feedsStore[feedUrl].items.length;
  const delete_mark = 'DELETE-NOW';
  for (let i=0; i<n; i++) {
    for (let j=i+1; j<n; j++) {
      if (GLB.feedsStore[feedUrl].items[i].link === GLB.feedsStore[feedUrl].items[j].link) {
        GLB.feedsStore[feedUrl].items[j].deleted = delete_mark;
      }
    }
  }
  const nBefore = GLB.feedsStore[feedUrl].items.length;
  GLB.feedsStore[feedUrl].items = GLB.feedsStore[feedUrl].items.filter(item => item.deleted != delete_mark);
  const nAfter = GLB.feedsStore[feedUrl].items.length;
  if (nBefore > nAfter) {
    GLB.feedsStoreChange = true;
    GLB.feedsStoreChangeList.add(feedUrl);
  }
  return nBefore - nAfter;
}

async function removeFeed(feedUrl: string) {
  for (let i=0; i<GLB.feedList.length; i++) {
    if (GLB.feedList[i].feedUrl === feedUrl) {
      if (GLB.feedsStore.hasOwnProperty(feedUrl)) {
        const slen = JSON.stringify(GLB.feedsStore[feedUrl], null, 0).length;
        const nfile = Math.ceil(slen/GLB.lenStrPerFile);
        delete GLB.feedsStore[feedUrl];
        await removeFileFragments(GLB.feeds_reader_dir + '/' + GLB.feeds_store_base, GLB.feedList[i].name, nfile);
        await removeFileFragments_gzipped(GLB.feeds_reader_dir + '/' + GLB.feeds_store_base, GLB.feedList[i].name, nfile);
      }
      GLB.feedList.splice(i, 1);
      GLB.feedsStoreChange = true;
      GLB.feedsStoreChangeList.add(feedUrl);
      await saveSubscriptions();
      break;
    }
  }
}

function handle_img_tag(s: string) {
    // return s.replace(/<img src="\/\/([^>]+>)/g, "\n<img src=\"https://$1\n");
  return s.replace(/<img src="\/\//g, "<img src=\"https://")
          .replace(/<img src="([^"]+)"[^>]+>/g, "\n![]($1)\n");
}

function handle_a_tag(s: string) {
  return s.replace(/<a href="\/\//g, "<a href=\"https://")
          .replace(/<a href="([^"]+)"\s*>([^<]*)<\/a>/g, "[$2]($1)");
}

function handle_tags(s: string) {
  return s.replace(/<p>/g, ' ').replace(/<\/p>(\s*\S)/g, '\n>\n> $1').replace(/<\/p>/g, ' ')
          .replace(/<div>/g, ' ').replace(/<\/div>/g, ' ')
          .replace(/<br>/g, ' ').replace(/<br\/>/g, ' ')
          .replace(/<span>/g, ' ').replace(/<\/span>/g, ' ');
}

function sort_feed_list() {
  GLB.feedList.sort((n1,n2) => {
    if (n1.folder > n2.folder) {return 1;}
    if (n1.folder < n2.folder) {return -1;}
    return 0;
  });
}

function makeDisplayList() {
  GLB.displayIndices = [];
  const fd = GLB.feedsStore[GLB.currentFeed];
  if (fd === undefined) {
    return;
  }
  for (let i=0; i<fd.items.length; i++) {
    if (GLB.showAll) {
      GLB.displayIndices.push(i);
    } else if (!(fd.items[i].read || fd.items[i].deleted)) {
      GLB.displayIndices.push(i);
    }
  }
  if (GLB.itemOrder === 'Old to new') {
    GLB.displayIndices.reverse();
  }
  if (GLB.itemOrder === 'Random') {
    // From: https://dev.to/codebubb/how-to-shuffle-an-array-in-javascript-2ikj
    (array => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
    })(GLB.displayIndices);
  }
}


async function show_feed() {
   if (GLB.currentFeed === '') {
     return;
   }
   const feed_content = document.getElementById('feed_content');
   if (!feed_content) return;
   feed_content.empty();

   const feedTitle = feed_content.createEl('h2');
   feedTitle.className = 'feedTitle';

   if (!GLB.feedsStore.hasOwnProperty(GLB.currentFeed)) {
     return;
   }
   const fd = GLB.feedsStore[GLB.currentFeed];
   feedTitle.createEl('a', {href: sanitizeHTMLToDom(fd.link).textContent || ''}).appendChild(sanitizeHTMLToDom(fd.title));
   if (fd.pubDate != '') {
     feed_content.createEl('div', {text: fd.pubDate});
   }
   feed_content.createEl('div').className = 'divAsSep';

   const elPageAction = feed_content.createEl('div');
   elPageAction.className = 'pageActions';
   // const markPageRead = elPageAction.createEl('span', {text: 'Mark all as read'});
   // markPageRead.className = 'markPageRead';
   const markPageReadDiv = elPageAction.createEl('div');
   const markPageReadSpan = markPageReadDiv.createEl('span');
   setIcon(markPageReadSpan, 'check-check');
   markPageReadDiv.title = 'Mark all as read';
   markPageReadDiv.className = 'markPageRead pageActionButton'; // Keep class, add general class

   // const markPageDeleted = elPageAction.createEl('span', {text: 'Mark all as deleted'});
   // markPageDeleted.className = 'markPageDeleted';
   const markPageDeletedDiv = elPageAction.createEl('div');
   const markPageDeletedSpan = markPageDeletedDiv.createEl('span');
   setIcon(markPageDeletedSpan, 'trash');
   markPageDeletedDiv.title = 'Mark all as deleted';
   markPageDeletedDiv.className = 'markPageDeleted pageActionButton'; // Keep class, add general class

   // const removePageContent = elPageAction.createEl('span', {text: 'Remove all content'});
   // removePageContent.className = 'removePageContent';
   const removePageContentDiv = elPageAction.createEl('div');
   const removePageContentSpan = removePageContentDiv.createEl('span');
   setIcon(removePageContentSpan, 'eraser');
   removePageContentDiv.title = 'Remove all content';
   removePageContentDiv.className = 'removePageContent pageActionButton'; // Keep class, add general class

   let nDisplayed = 0;
   for (let i=GLB.idxItemStart;
        i<Math.min(GLB.displayIndices.length, GLB.idxItemStart+GLB.nItemPerPage);
        i++) {
     const idx = GLB.displayIndices[i];
     const item = fd.items[idx];
     const itemEl = feed_content.createEl('div');
     itemEl.className = 'oneFeedItem';
     itemEl.id = item.link;
     const itemTitle = itemEl.createEl('div');
     itemTitle.className = 'itemTitle';
     if (!GLB.titleOnly) {
       itemTitle.createEl('a', {href: sanitizeHTMLToDom(item.link).textContent || ''})
                .appendChild(sanitizeHTMLToDom(item.title));
     } else {
       const elTitle = itemTitle.createEl('div');
       elTitle.appendChild(sanitizeHTMLToDom(item.title));
       elTitle.className = 'showItemContent';
       elTitle.setAttribute('_link', item.link);
       elTitle.setAttribute('_idx', idx.toString());
       elTitle.setAttribute('showContent', '0');
     }
     if (item.creator) {
       const elCreator = itemEl.createEl('div');
       elCreator.className = 'itemCreator';
       elCreator.appendChild(sanitizeHTMLToDom(item.creator));
     }
     let elPubDate;
     if (item.pubDate) {
       elPubDate = itemEl.createEl('div', {text: item.pubDate});
     } else {
       elPubDate = itemEl.createEl('div', {text: item.downloaded || ''});
     }
     elPubDate.className = 'elPubDate';
     const elActionContainer = itemEl.createEl('div');
     elActionContainer.id = 'actionContainer' + idx;
     const itemActionTable = elActionContainer.createEl('table');
     itemActionTable.className = 'actionTable';
     let itemActionOneRow = itemActionTable.createEl('tr').createEl('td');
     itemActionOneRow.className = 'itemActions';

     if (GLB.settings.showJot) {
       const jotDiv = itemActionOneRow.createEl('div');
       const jotSpan = jotDiv.createEl('span');
       setIcon(jotSpan, 'sticky-note');
       jotDiv.title = 'Jot';
       jotDiv.className = 'jotNotes'; // Add class to the div
       jotDiv.id = 'jotNotes' + idx; // Keep id on the div
     }

     if (GLB.settings.showSnippet) {
       const saveSnippetDiv = itemActionOneRow.createEl('div');
       const saveSnippetSpan = saveSnippetDiv.createEl('span');
       setIcon(saveSnippetSpan, 'bookmark');
       saveSnippetDiv.title = 'Snippet';
       saveSnippetDiv.className = 'saveSnippet';
       saveSnippetDiv.id = 'saveSnippet' + idx;
     }

     if (GLB.settings.showRead) {
       let t_read_icon = "eye-off"; // Changed from "circle"
       let t_read_title = "Mark as read";
       if (item.read && (item.read !== '')) {
         t_read_icon = 'eye'; // Changed from "check"
         t_read_title = 'Mark as unread';
       }
       const toggleReadDiv = itemActionOneRow.createEl('div');
       const toggleReadSpan = toggleReadDiv.createEl('span');
       setIcon(toggleReadSpan, t_read_icon);
       toggleReadDiv.title = t_read_title;
       toggleReadDiv.className = 'toggleRead';
       toggleReadDiv.id = 'toggleRead' + idx;
     }

     if (GLB.settings.showSave) {
       const noteThisDiv = itemActionOneRow.createEl('div');
       const noteThisSpan = noteThisDiv.createEl('span');
       setIcon(noteThisSpan, 'file-output');
       noteThisDiv.title = 'Save';
       noteThisDiv.className = 'noteThis';
       noteThisDiv.id = 'noteThis' + idx;
     }

     if (GLB.settings.showMath) {
       const renderMathDiv = itemActionOneRow.createEl('div');
       const renderMathSpan = renderMathDiv.createEl('span');
       setIcon(renderMathSpan, 'calculator');
       renderMathDiv.title = 'Render Math';
       renderMathDiv.className = 'renderMath';
       renderMathDiv.id = 'renderMath' + idx;
     }

     if (GLB.settings.showGPT) {
       const askChatGPTDiv = itemActionOneRow.createEl('div');
       const askChatGPTSpan = askChatGPTDiv.createEl('span');
       setIcon(askChatGPTSpan, 'brain');
       askChatGPTDiv.title = 'Ask GPT';
       askChatGPTDiv.className = 'askChatGPT';
       askChatGPTDiv.id = 'askChatGPT' + idx;
     }

     if (GLB.settings.showEmbed) {
       const embedDiv = itemActionOneRow.createEl('div');
       const embedSpan = embedDiv.createEl('span');
       setIcon(embedSpan, 'code-2');
       embedDiv.title = 'Embed';
       embedDiv.setAttribute('url', item.link);
       embedDiv.setAttribute('_idx', idx.toString());
       embedDiv.setAttribute('_link', item.link);
       embedDiv.className = 'elEmbedButton';
     }

     if (GLB.settings.showFetch) {
       const fetchDiv = itemActionOneRow.createEl('div');
       const fetchSpan = fetchDiv.createEl('span');
       setIcon(fetchSpan, 'download');
       fetchDiv.title = 'Fetch';
       fetchDiv.setAttribute('url', item.link);
       fetchDiv.setAttribute('_idx', idx.toString());
       fetchDiv.setAttribute('_link', item.link);
       fetchDiv.className = 'elFetch';
     }

     if (GLB.settings.showLink) {
       // Create an anchor tag directly for the link button
       const elLink = itemActionOneRow.createEl('a', {
         href: item.link
         // Remove target and rel from here
       });
       // Set target and rel using setAttribute
       elLink.setAttribute('target', '_blank'); 
       elLink.setAttribute('rel', 'noopener noreferrer');
       elLink.className = 'elLink'; // Apply class to the anchor
       elLink.title = 'Open link in browser'; // Set tooltip
       // Add the icon inside the anchor
       const linkSpan = elLink.createEl('span'); 
       setIcon(linkSpan, 'external-link');
     }

     if (GLB.settings.showDelete) {
       let t_delete_icon = "trash-2"; // Icon for not deleted
       let t_delete_title = "Delete";
       if (item.deleted && (item.deleted !== '')) {
         t_delete_icon = 'history'; // Icon for deleted (can be restored)
         t_delete_title = 'Undelete';
       }
       const toggleDeleteDiv = itemActionOneRow.createEl('div');
       const toggleDeleteSpan = toggleDeleteDiv.createEl('span');
       setIcon(toggleDeleteSpan, t_delete_icon);
       toggleDeleteDiv.title = t_delete_title;
       toggleDeleteDiv.className = 'toggleDelete';
       toggleDeleteDiv.id = 'toggleDelete' + idx;
     }

     if ((!GLB.titleOnly) && item.content) {
       const elContent = itemEl.createEl('div');
       elContent.className = 'itemContent';
       elContent.id = 'itemContent' + idx;
       elContent.appendChild(sanitizeHTMLToDom(item.content.replace(/<img src="\/\//g,"<img src=\"https://")));
     }
     nDisplayed += 1;
   }

   if (nDisplayed == 0) {
     elPageAction.remove();
   }
   if (nDisplayed >= 5) {
     feed_content.appendChild(elPageAction.cloneNode(true));
   }

   const next_prev = feed_content.createEl('div');
   next_prev.className = 'next_prev';
   if (GLB.nPage > 1) {
     const prevPage = next_prev.createEl('span', {text: "Prev"});
     prevPage.id = "prevPage";
   }
   if (GLB.idxItemStart+GLB.nItemPerPage < GLB.displayIndices.length) {
     const nextPage = next_prev.createEl('span', {text: "Next"});
     nextPage.id = "nextPage";
   }
   const stats = getFeedStats(GLB.currentFeed);
   //  GLB.elUnreadCount = document.getElementById('unreadCount' + GLB.currentFeed);
   GLB.elTotalCount = document.getElementById('totalCount' + GLB.currentFeed) || undefined;
   GLB.elSepUnreadTotal = document.getElementById('sepUnreadTotal' + GLB.currentFeed) || undefined;
   if (GLB.elUnreadCount) {
     GLB.elUnreadCount.innerText = stats.unread.toString();
   }
   if (fd.items.length < GLB.maxTotalnumDisplayed) {
     if (GLB.elTotalCount) {
       GLB.elTotalCount.innerText = fd.items.length.toString();
     }
     if (GLB.elSepUnreadTotal) {
       GLB.elSepUnreadTotal.innerText = '/';
     }
   } else {
     if (GLB.elTotalCount) {
       GLB.elTotalCount.innerText = '';
     }
     if (GLB.elSepUnreadTotal) {
       GLB.elSepUnreadTotal.innerText = '';
     }
   }
}


function sanitize(s: string) {
  // https://stackoverflow.com/questions/6659351/removing-all-script-tags-from-html-with-js-regular-expression
  const SCRIPT_REGEX = /<script(?:(?!\/\/)(?!\/\*)[^'"]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*(?:\n)|\/\*(?:(?:.|\s))*?\*\/)*?<\/script\s*>/gi;
  const onerror_regex = /onerror\s*=\s*/gi;
  const onclick_regex = /onclick\s*=\s*/gi;
  const onmouseover_regex = /onmouseover\s*=\s*/gi;
  const onload_regex = /onload\s*=\s*/gi;
  [SCRIPT_REGEX, onerror_regex, onclick_regex, onmouseover_regex, onload_regex].forEach(r => {
    while (r.test(s)) {
      s = s.replace(r, " ");
    }
  });
  return s;
}

export async function loadSubscriptions() {
  const fpath_feedList = GLB.feeds_reader_dir+'/'+GLB.subscriptions_fname;
  GLB.feedList = [];
  if (await this.app.vault.exists(fpath_feedList)) {
    GLB.feedList = await JSON.parse(await
      this.app.vault.adapter.read(fpath_feedList));
  }
  if (GLB.feedList.length == 0) {
    new Notice('No feed yet. Use "Add feed".', 5000);
  }
  sort_feed_list();
}


async function saveSubscriptions() {
  if (! await this.app.vault.exists(GLB.feeds_reader_dir)) {
    await this.app.vault.createFolder(GLB.feeds_reader_dir);
  }
  const fpath_feedList = GLB.feeds_reader_dir+'/'+GLB.subscriptions_fname;
  if (! await this.app.vault.exists(fpath_feedList)) {
      await this.app.vault.create(fpath_feedList, JSON.stringify(GLB.feedList, null, 1));
  } else {
      await this.app.vault.adapter.write(fpath_feedList, JSON.stringify(GLB.feedList, null, 1));
  }
}

async function saveStringToFileGzip(s: string, folder: string, fname: string) {
  let written = 0, success = true;
  if (! await this.app.vault.exists(folder)) {
    await this.app.vault.createFolder(folder);
  }
  const s_gzipped = await compress(s, 'gzip');
  const fpath = folder + "/" + fname + '.gzip';
  if (! await this.app.vault.exists(fpath)) {
    await this.app.vault.createBinary(fpath, s_gzipped);
    written = 1;
  } else {
    if ((await decompress(await this.app.vault.adapter.readBinary(fpath), 'gzip')) !== s) {
      await this.app.vault.adapter.remove(fpath);
      await this.app.vault.createBinary(fpath, s_gzipped);
      written = 1;
    }
  }
  try {
    const readBack = await decompress(await this.app.vault.adapter.readBinary(fpath), 'gzip');
    if (readBack !== s) {
      success = false;
      new Notice('Readback content mismatch while saving: ' + fpath, 3000);
    }
  } catch (e) {
    success = false;
    new Notice('Error reading back: ' + fpath, 3000);
  }
  if (!success) {
    if (await this.app.vault.exists(fpath)) {
      await this.app.vault.adapter.remove(fpath);
    }
    written = await saveStringToFile(s, folder, fname);
    new Notice('Failed to save as gzip; save as plain text instead: ' + folder + "/" + fname, 1000);
  } else {
    if (await this.app.vault.exists(folder + "/" + fname)) {
      await this.app.vault.adapter.remove(folder + "/" + fname);
    }
  }
  return written;
}

async function saveStringToFile(s: string, folder: string, fname: string) {
  let written = 0;
  if (! await this.app.vault.exists(folder)) {
    await this.app.vault.createFolder(folder);
  }
  const fpath = folder + "/" + fname;
  if (! await this.app.vault.exists(fpath)) {
    await this.app.vault.create(fpath, s);
    written = 1;
  } else {
    if ((await this.app.vault.adapter.read(fpath)) != s) {
      await this.app.vault.adapter.write(fpath, s);
      written = 1;
    }
  }
  return written;
}

async function saveStringSplitted(s: string, folder: string, fname_base: string, nCharPerFile: number) {
  const nLen = s.length;
  let iEnd = nLen;
  let iBg = nLen - nCharPerFile;
  let i = 0, nSaved = 0;
  for (i=0;;i++) {
    if (iBg < 0) {
      iBg = 0;
    }
    if (iBg >= iEnd) {
      break;
    }
    const fname = makeFilename(fname_base, i);
    nSaved += (await saveStringToFileGzip(s.substring(iBg, iEnd), folder, fname));
    iEnd = iEnd - nCharPerFile;
    iBg = iBg - nCharPerFile;
  }
  try {
    // Remove redundant files with higher serial number.
    for (;;i++) {
      const fpath_unneeded = folder + '/' + makeFilename(fname_base, i) + '.gzip';
      if (await this.app.vault.exists(fpath_unneeded)) {
        await this.app.vault.adapter.remove(fpath_unneeded);
        new Notice('Redundant file ' + fpath_unneeded + ' removed.', 2000);
      } else {
        break;
      }
    }
  } catch (e) {
    console.log(e);
  }
  return nSaved;
}

async function loadStringSplitted_Gzip(folder: string, fname_base: string) {
  let res = '';
  if (await this.app.vault.exists(folder)) {
    for (let i=0;;i++) {
      const fpath_plain = folder + '/' + makeFilename(fname_base, i);
      const fpath = fpath_plain + '.gzip';
      const gzip_exist = await this.app.vault.exists(fpath);
      const plain_exist = await this.app.vault.exists(fpath_plain);
      if ((! plain_exist) && (! gzip_exist)) {
        break;
      }
      let s_partial;
      if (gzip_exist) {
        try {
          s_partial = await decompress(await this.app.vault.adapter.readBinary(fpath), 'gzip');
        } catch (e) {
          new Notice('Error reading: ' + fpath + '\nTry with: ' + fpath_plain, 1000);
          s_partial = await this.app.vault.adapter.read(fpath_plain);
        }
      } else {
        s_partial = await this.app.vault.adapter.read(fpath_plain);
      }
      res = s_partial.concat('', res);
    }
  }
  return res;
}

async function loadStringSplitted(folder: string, fname_base: string) {
  let res = '';
  if (await this.app.vault.exists(folder)) {
    for (let i=0;;i++) {
      const fpath = folder + '/' + makeFilename(fname_base, i);
      if (! await this.app.vault.exists(fpath)) {
        break;
      }
      res = (await this.app.vault.adapter.read(fpath)).concat('', res);
    }
  }
  return res;
}

function makeFilename (fname_base: string, iPostfix: number) {
  return fname_base + '-' + iPostfix.toString() + '.json.frag';
}

async function removeFileFragments(folder: string, fname_base: string, nfile: number) {
  for (let i=0;i<nfile;i++) {
    const fpath = folder + '/' + makeFilename(fname_base, i);
    if (! await this.app.vault.exists(fpath)) {
      continue;
    }
    await this.app.vault.adapter.remove(fpath);
    new Notice(fpath + ' removed.', 2000);
  }
}

async function removeFileFragments_gzipped(folder: string, fname_base: string, nfile: number) {
  for (let i=0;i<nfile;i++) {
    const fpath = folder + '/' + makeFilename(fname_base, i) + '.gzip';
    if (! await this.app.vault.exists(fpath)) {
      continue;
    }
    await this.app.vault.adapter.remove(fpath);
    new Notice(fpath + ' removed.', 2000);
  }
}

export async function fetchChatGPT(apiKey: string, temperature: number, text: string) {
  const res = await
    fetch('https://api.openai.com/v1/chat/completions',
          {method: 'POST',
           mode: 'cors',
           headers: {
              Authorization: 'Bearer ' + apiKey,
              'Content-Type': 'application/json'},
           body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              temperature: temperature,
              messages: [{role: "user",
                          content: text}]})});
  const msg = (await res.json())['choices'][0].message;
  return msg.content;
}

function remedyLatex(s: string) {
  return s.replace(/\$(\\[a-zA-Z]+)\$([0-9+-.]+)/g, '\${\$1}$2\$')
          .replace(/\\micron/g, '\\mu{}m')
          .replace(/\\Msun/g, 'M_\\odot')
          .replace(/\\Mstar/g, 'M_\\ast')
          .replace(/_\*/g, '_\\ast')
          .replace(/_{\*}/g, '_{\\ast}')
          .replace(/\*/g, '\\*');
}

async function compress(string: string, format: CompressionFormat) {
  // From: https://wicg.github.io/compression/
  const byteArray = new TextEncoder().encode(string);
  const cs = new CompressionStream(format);
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const output = [];
  const reader = cs.readable.getReader();
  let totalSize = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done)
      break;
    output.push(value);
    totalSize += value.byteLength;
  }
  const concatenated = new Uint8Array(totalSize);
  let offset = 0;
  for (const array of output) {
    concatenated.set(array, offset);
    offset += array.byteLength;
  }
  return concatenated;
}

async function decompress(byteArray: Uint8Array, format: CompressionFormat) {
  const cs = new DecompressionStream(format);
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const r = new Response(cs.readable);
  const a = await r.arrayBuffer();
  return new TextDecoder().decode(a);
}

