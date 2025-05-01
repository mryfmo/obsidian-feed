import { ItemView, WorkspaceLeaf, Notice, setIcon, sanitizeHTMLToDom, htmlToMarkdown, TFile, MarkdownRenderer, request } from "obsidian";
import { GLB } from "./globals"
import FeedsReader, { saveFeedsData, loadSubscriptions, loadFeedsStoredData, getFeedStats, fetchChatGPT } from "./main"

export const VIEW_TYPE_FEEDS_READER = "feeds-reader-view";

export function getNumFromId(idstr: string, pref: string): number {
    const n = pref.length;
    return parseInt(idstr.substring(n));
}

export function nowdatetime(): string {
  const a = new Date();
  return a.toISOString();
}

export class FRView extends ItemView {
  plugin: FeedsReader;

  constructor(leaf: WorkspaceLeaf, plugin: FeedsReader) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_FEEDS_READER;
  }

  getDisplayText() {
    return "Feeds Reader";
  }

  async onOpen() {
    const startTime = performance.now();
    await loadSubscriptions();
    await loadFeedsStoredData();
    const endTime = performance.now();
    const timeSpent = (endTime-startTime)/1e3;
    if (timeSpent > 0.02) {
      const tStr = timeSpent.toFixed(2);
      new Notice(`Data loaded in ${tStr} seconds.`, 2000);
    }

    const container = this.containerEl.children[1];
    if (container === undefined) {
      console.log('Fail to get container.');
      return;
    }

    container.empty();

    const toggleNaviContainer = container.createEl('div');
    toggleNaviContainer.className = 'toggleNaviContainer';
    toggleNaviContainer.id = 'toggleNaviContainer';
    const toggleNavi = toggleNaviContainer.createEl('span');
    setIcon(toggleNavi, 'panel-left-open');
    toggleNavi.id = 'toggleNavi';
    toggleNavi.className = 'toggleNavi';
    toggleNavi.title = "Hide navigation";
    const toggleNaviAux = toggleNaviContainer.createEl('span');
    toggleNaviAux.id = 'toggleNaviAux';
    toggleNaviAux.className = 'toggleNaviAux';

    const navigation = container.createEl("div", {cls: 'navigation'});
    const content = container.createEl("div", {cls: "content"});
    navigation.className = 'navigation';
    content.className = 'content';
    navigation.id = 'naviBar';
    content.id = 'contentBox';

    const manage = navigation.createEl('div');
    manage.className = 'manage';
    const searchDiv = manage.createEl('div');
    const search = searchDiv.createEl('span');
    setIcon(search, 'search');
    searchDiv.title = "Search";
    searchDiv.id = 'search';
    const showAllDiv = manage.createEl('div');
    const showAll = showAllDiv.createEl('span');
    setIcon(showAll, 'filter');
    showAllDiv.title = "Unread only / Show all";
    showAllDiv.id = 'showAll';
    const titleOnlyDiv = manage.createEl('div');
    const titleOnly = titleOnlyDiv.createEl('span');
    setIcon(titleOnly, 'layout-list');
    titleOnlyDiv.title = "Title only / Show content";
    titleOnlyDiv.id = 'titleOnly';
    const toggleOrderDiv = manage.createEl('div');
    const toggleOrder = toggleOrderDiv.createEl('span');
    if (GLB.itemOrder === 'Old to new') {
        setIcon(toggleOrder, 'arrow-up-down');
        toggleOrderDiv.title = "Sort: Old to new";
    } else if (GLB.itemOrder === 'Random') {
        setIcon(toggleOrder, 'shuffle');
        toggleOrderDiv.title = "Sort: Random";
    } else {
        setIcon(toggleOrder, 'arrow-down-up');
        toggleOrderDiv.title = "Sort: New to old";
    }
    toggleOrderDiv.id = 'toggleOrder';
    const saveFeedsDataDiv = manage.createEl('div');
    const saveFeedsData = saveFeedsDataDiv.createEl('span');
    setIcon(saveFeedsData, 'save');
    saveFeedsDataDiv.title = "Save data";
    saveFeedsDataDiv.id = 'saveFeedsData';
    const updateAllDiv = manage.createEl('div');
    const updateAll = updateAllDiv.createEl('span');
    setIcon(updateAll, 'refresh-cw');
    updateAllDiv.title = "Update all";
    updateAllDiv.id = 'updateAll';
    const undoDiv = manage.createEl('div');
    const undo = undoDiv.createEl('span');
    setIcon(undo, 'undo');
    undoDiv.title = "Undo";
    undoDiv.id = 'undo';
    const addDiv = manage.createEl('div');
    const add = addDiv.createEl('span');
    setIcon(add, 'plus');
    addDiv.title = "Add feed";
    addDiv.id = 'addFeed';
    const manageFeedsDiv = manage.createEl('div');
    const manageFeeds = manageFeedsDiv.createEl('span');
    setIcon(manageFeeds, 'settings');
    manageFeedsDiv.title = "Manage feeds";
    manageFeedsDiv.id = 'manageFeeds';
    manage.createEl('hr');

    const feedTableDiv = navigation.createEl('div');
    feedTableDiv.className = 'feedTableDiv';
    const feedTable = feedTableDiv.createEl('table');
    feedTable.id = 'feedTable';
    waitForElm('#feedTable').then(async () => {
      await createFeedBar();
    });

    if (GLB.feedList.length > 0) {
      if (GLB.feedList.length < GLB.nThanksSep) {
        const nVertSep = GLB.nThanksSep-GLB.feedList.length;
        for (let i=0; i<nVertSep; i++) {
          feedTableDiv.createEl('br');
        }
      }
      feedTableDiv.createEl('hr');
      const thanksTable = feedTableDiv.createEl('table');
      const thanks = thanksTable.createEl('tr');
      thanks.className = 'thanks';
      thanks.createEl('td').createEl('a', {text: "Thanks", href: "https://www.buymeacoffee.com/mryfmo"});
      thanks.createEl('td').createEl('span', {text: "or"});
      thanks.createEl('td').createEl('a', {text: "Complain", href: "https://github.com/mryfmo/obsidian-feed/issues"});
    }

    const feed_content = content.createEl('div');
    feed_content.id = 'feed_content';

    // Register event listener for content area within the view
    this.registerDomEvent(content, 'click', async (evt) => {
        const target = evt.target as HTMLElement;
        if (!target) return;

        const toggleReadDiv = target.closest('.toggleRead') as HTMLElement;
        if (toggleReadDiv) {
            const idx = getNumFromId(toggleReadDiv.id, 'toggleRead'); 
            const item = GLB.feedsStore[GLB.currentFeed]?.items[idx];
            const toggleSpan = toggleReadDiv?.querySelector('span');

            if (toggleSpan && item) {
                GLB.feedsStoreChange = true;
                GLB.feedsStoreChangeList.add(GLB.currentFeed);
                if (item.read === '') {
                    item.read = nowdatetime(); 
                    setIcon(toggleSpan, 'eye');
                    toggleReadDiv.title = 'Mark as unread';
                    GLB.hideThisItem = true;
                    if (GLB.elUnreadCount) {
                        GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) - 1).toString();
                    }
                } else {
                    item.read = '';
                    setIcon(toggleSpan, 'eye-off');
                    toggleReadDiv.title = 'Mark as read';
                    GLB.hideThisItem = false;
                    if (!item.deleted) {
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
                    const el = document.getElementById(item.link);
                    if (el) el.className = 'hidedItem';
                }
            }
            return; // Handled
        }

        const toggleDeleteDiv = target.closest('.toggleDelete') as HTMLElement;
        if (toggleDeleteDiv) {
            const idx = getNumFromId(toggleDeleteDiv.id, 'toggleDelete'); 
            const item = GLB.feedsStore[GLB.currentFeed]?.items[idx];
            const toggleSpan = toggleDeleteDiv?.querySelector('span');

            if (toggleSpan && item) {
                GLB.feedsStoreChange = true;
                GLB.feedsStoreChangeList.add(GLB.currentFeed);
                if (item.deleted === '') { 
                    item.deleted = nowdatetime(); 
                    setIcon(toggleSpan, 'history');
                    toggleDeleteDiv.title = 'Undelete';
                    GLB.hideThisItem = true;
                    if (!item.read) {
                        if (GLB.elUnreadCount) {
                            GLB.elUnreadCount.innerText = (parseInt(GLB.elUnreadCount.innerText) - 1).toString();
                        }
                    }
                } else { 
                    item.deleted = '';
                    setIcon(toggleSpan, 'trash-2');
                    toggleDeleteDiv.title = 'Delete';
                    GLB.hideThisItem = false;
                    if (!item.read) {
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
                    const el = document.getElementById(item.link);
                    if (el) el.className = 'hidedItem';
                }
            }
            return; // Handled
        }

        const jotDiv = target.closest('.jotNotes') as HTMLElement;
        if (jotDiv) {
            const idx = getNumFromId(jotDiv.id, 'jotNotes');
            const el = document.getElementById('shortNoteContainer' + idx);
             if (el !== null) {
                 return; // Already open
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
             shortNote.placeholder = 'Enter notes here...';
            return; // Handled
        }

        const saveSnippetDiv = target.closest('.saveSnippet') as HTMLElement;
        if (saveSnippetDiv) {
            const idx = getNumFromId(saveSnippetDiv.id, 'saveSnippet');
            if (! await this.plugin.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
              await this.plugin.app.vault.createFolder(GLB.feeds_reader_dir);
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
            if (the_item.pubDate != '') { dt_str = the_item.pubDate; } 
            else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') { dt_str = GLB.feedsStore[GLB.currentFeed].pubDate; }
            if (dt_str !== '') { dt_str = '\n> <small>' + dt_str + '</small>'; }
            let feedNameStr = GLB.currentFeedName;
            if (feedNameStr !== '') { feedNameStr = '\n> <small>' + feedNameStr + '</small>'; }
            let theContent = '';
            if (GLB.saveContent) {
                 let author_text = the_item.creator ? the_item.creator.trim() : '';
                 if (author_text !== '') { author_text = '\n> ' + htmlToMarkdown(author_text); }
                 let ctt = the_item.content ? the_item.content : '';
                 theContent = htmlToMarkdown(ctt); // Simplified, assuming helpers are available
            }
            const snippet_content: string = shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' + the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") + '](' + link_text + ')\n> ' + theContent + dt_str + feedNameStr;
            if (! await this.plugin.app.vault.adapter.exists(fpath)) {
              await this.plugin.app.vault.create(fpath, snippet_content);
              new Notice(fpath + " saved.", 1000);
            } else {
              const prevContent: string = (await this.plugin.app.vault.adapter.read(fpath)) || '';
              if (prevContent.includes(link_text)) {
                new Notice("Snippet url already exists.", 1000);
              } else {
                if (GLB.saveSnippetNewToOld) {
                  await this.plugin.app.vault.process(this.plugin.app.vault.getAbstractFileByPath(fpath) as TFile, (data: any) => snippet_content + '\n\n<hr>\n\n' + data);
                } else {
                  await this.plugin.app.vault.adapter.append(fpath, '\n\n<hr>\n\n' + snippet_content);
                }
                new Notice("Snippet saved to " + fpath + ".", 1000);
              }
            }
            return; // Handled
        }

        const noteThisDiv = target.closest('.noteThis') as HTMLElement;
        if (noteThisDiv) {
            const idx = getNumFromId(noteThisDiv.id, 'noteThis');
            if (! await this.plugin.app.vault.adapter.exists(GLB.feeds_reader_dir)) {
              await this.plugin.app.vault.createFolder(GLB.feeds_reader_dir);
            }
            const the_item = GLB.feedsStore[GLB.currentFeed].items[idx];
            let dt_str: string = nowdatetime();
            if (the_item.pubDate != '') { dt_str = the_item.pubDate; } 
            else if (GLB.feedsStore[GLB.currentFeed].pubDate != '') { dt_str = GLB.feedsStore[GLB.currentFeed].pubDate; }
            dt_str = dt_str.substring(0, 10) + '-';
            // Assuming str2filename is available
            const fname_base = (GLB.currentFeedName === ''? '' : GLB.currentFeedName.replace(/(\s+)/g, '-') + '-') + the_item.title.trim().replace(/(<([^>]+)>)/g, " ").replace(/[:!?@#\*\^\$]+/g, '');
            const fname = dt_str + str2filename(fname_base.substring(0, 50)) + '.md'; // Simplified filename gen + added str2filename call
            const fpath: string = GLB.feeds_reader_dir + '/' + fname;
            let shortNoteContent = '';
            const elShortNote = document.getElementById('shortNote' + idx) as HTMLInputElement;
            if (elShortNote !== null) { shortNoteContent = elShortNote.value; }
            let abstractOpen = '-';
            let theContent = '';
            if (GLB.saveContent) {
                let author_text = the_item.creator ? the_item.creator.trim() : '';
                if (author_text !== '') { author_text = '\n> ' + htmlToMarkdown(author_text); }
                let ctt = the_item.content ? the_item.content : '';
                theContent = htmlToMarkdown(ctt) + author_text; // Simplified
            }
            if (! await this.plugin.app.vault.adapter.exists(fpath)) {
              await this.plugin.app.vault.create(fpath, shortNoteContent + '\n> [!abstract]' + abstractOpen + ' [' + the_item.title.trim().replace(/(<([^>]+)>)/gi, " ").replace(/\n/g, " ") + '](' + sanitizeHTMLToDom(the_item.link).textContent + ')\n> ' + theContent);
              new Notice(fpath + " saved.", 1000);
            } else {
              new Notice(fpath + " already exists.", 1000);
            }
            return; // Handled
        }

        const renderMathDiv = target.closest('.renderMath') as HTMLElement;
        if (renderMathDiv) {
            const idx = getNumFromId(renderMathDiv.id, 'renderMath');
            let elContent = document.getElementById('itemContent' + idx);
            const item = GLB.feedsStore[GLB.currentFeed].items[idx];
            if (item.content) {
                const elID = item.link;
                if (elContent !== null) { elContent.empty(); }
                else { 
                    const itemEl = document.getElementById(elID);
                    if (!itemEl) return;
                    elContent = itemEl.createEl('div');
                    elContent.id = 'itemContent' + idx;
                }
                if(elContent) {
                    elContent.className = 'itemContent';
                     // Assuming remedyLatex is available
                     MarkdownRenderer.render(this.plugin.app, remedyLatex(htmlToMarkdown(item.content)), elContent, item.link, this.plugin);
                 }
            }
            return; // Handled
        }

        const askChatGPTDiv = target.closest('.askChatGPT') as HTMLElement;
        if (askChatGPTDiv) {
            const idx = getNumFromId(askChatGPTDiv.id, 'askChatGPT');
            const item = GLB.feedsStore[GLB.currentFeed]?.items[idx];
            if (!item?.content) { return; }
            
            let el = document.getElementById('shortNoteContainer' + idx);
            if (el === null) {
                const elActionContainer = document.getElementById('actionContainer' + idx);
                if (elActionContainer === null) { return; }
                const shortNoteContainer = elActionContainer.createEl('div');
                shortNoteContainer.id = 'shortNoteContainer' + idx;
                const shortNote = shortNoteContainer.createEl('textarea');
                shortNote.className = 'shortNote';
                shortNote.id = 'shortNote' + idx;
                shortNote.rows = 2;
                shortNote.placeholder = 'Waiting for ChatGPT...';
            }
            const apiKey = this.plugin.settings.chatGPTAPIKey;
            const promptText = this.plugin.settings.chatGPTPrompt;
            try {
                let replyByGPT = await fetchChatGPT(apiKey, 0.0, promptText + '\n' + item.content);
                replyByGPT = replyByGPT.trim();
                const shortNote = document.getElementById('shortNote' + idx) as HTMLTextAreaElement;
                if (shortNote && replyByGPT !== '') {
                     let existingNote = shortNote.value;
                     if (existingNote !== '') { existingNote = existingNote + '\n\n'; }
                     shortNote.value = existingNote + replyByGPT;
                }
            } catch (e) { console.error("Error fetching ChatGPT:", e); new Notice("Failed to get response from ChatGPT."); }
            return; // Handled askChatGPT
        }

        const embedDiv = target.closest('.elEmbedButton') as HTMLElement;
        if (embedDiv) {
            const idx = embedDiv.getAttribute('_idx');
            const elID = embedDiv.getAttribute('_link');
             if (document.getElementById('embeddedIframe' + idx) !== null) { return; }
             let elContent = document.getElementById('itemContent' + idx);
             if (elContent !== null) { elContent.empty(); }
             else {
                 const itemEl = document.getElementById(elID as string) as HTMLElement;
                 if (!itemEl) { new Notice('Failed... ID: ' + elID); return; }
                 elContent = itemEl.createEl('div');
                 elContent.className = 'itemContent';
                 elContent.id = 'itemContent' + idx;
             }
             const url = embedDiv.getAttribute('url');
             if (elContent && url) {
                 const embeddedIframe = elContent.createEl('iframe');
                 embeddedIframe.className = 'embeddedIframe';
                 embeddedIframe.id = 'embeddedIframe' + idx;
                 embeddedIframe.src = url;
             }
            return; // Handled
        }

        const fetchDiv = target.closest('.elFetch') as HTMLElement;
        if (fetchDiv) {
            const idx = fetchDiv.getAttribute('_idx');
            const elID = fetchDiv.getAttribute('_link');
            const url = fetchDiv.getAttribute('url');
            if (!url) { new Notice('No URL for fetch.'); return; }
            if (document.getElementById('fetchContainer' + idx) !== null) { return; }
            let pageSrc: string | null = null;
            try { 
                 const response = await request({url: url, method: "GET"}); 
                 if (response === null) { new Notice('Fail fetch: ' + url); return; }
                 pageSrc = response; 
            } catch (e) { new Notice('Fail fetch: ' + url); return; }
            let elContent = document.getElementById('itemContent' + idx);
            if (elContent !== null) { elContent.empty(); }
            else {
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
           return; // Handled elFetch
        }

    });
  }

  async onClose() {
    // Nothing to clean up.
    await saveFeedsData();
    this.containerEl.empty();
  }
}

export async function createFeedBar() {
  const feedTable = document.getElementById('feedTable');
  if (!feedTable) return;
  await feedTable.empty();
  let thisFolder = "";
  GLB.feedList.forEach(async (item, idx) => {
    if (item.folder != thisFolder) {
      thisFolder = item.folder;
      if (thisFolder != "") {
        feedTable.createEl('tr').createEl('td').createEl('span', {text: thisFolder}).className = 'feedFolder';
      }
    }
    const tr = feedTable.createEl('tr');
    const showFeed = tr.createEl('td', {text: item.name});
    showFeed.className = 'showFeed';
    showFeed.id = item.feedUrl;

    const stats = getFeedStats(item.feedUrl);

    const elUnreadTotal = tr.createEl('td');
    elUnreadTotal.setAttribute('fdUrl', item.feedUrl);
    elUnreadTotal.setAttribute('fdName', item.name);
    elUnreadTotal.className = 'elUnreadTotalAndRefresh';
    const unreadCount = elUnreadTotal.createEl('span', {text: stats.unread.toString()});
    unreadCount.className = 'unreadCount';
    unreadCount.id = 'unreadCount' + item.feedUrl;
    const elSep = elUnreadTotal.createEl('span', {text: '/'});
    elSep.className = 'unreadCount';
    elSep.id = 'sepUnreadTotal'+item.feedUrl;
    const totalCount = elUnreadTotal.createEl('span', {text: stats.total.toString()});
    totalCount.className = 'unreadCount';
    totalCount.id = 'totalCount' + item.feedUrl;
  });
}

export function waitForElm(selector: string) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function str2filename(s: string) {
  const illegalRe = /[\/?<>\\:\*\|"]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const windowsTrailingRe = /[\. ]+$/;
  const replacement = ' ';
  s = unEscape(s); // Depends on unEscape
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
                  .replace(/&#39;/g , "'")
                  .replace(/&amp;/g , "&")
                  .replace(/&nbsp;/g , " ");
}

function handle_img_tag(s: string) {
  return s.replace(/<img src="\/\//g, "<img src=\"https://")
          .replace(/<img src="([^\"]+)"[^>]+>/g, "\n![]($1)\n");
}

function handle_a_tag(s: string) {
  return s.replace(/<a href="\/\//g, "<a href=\"https://")
          .replace(/<a href="([^\"]+)"\s*>([^<]*)<\/a>/g, "[$2]($1)");
}

function handle_tags(s: string) {
  return s.replace(/<p>/g, ' ').replace(/<\/p>(\s*\S)/g, '\n>\n> $1').replace(/<\/p>/g, ' ')
          .replace(/<div>/g, ' ').replace(/<\/div>/g, ' ')
          .replace(/<br>/g, ' ').replace(/<br\/>/g, ' ')
          .replace(/<span>/g, ' ').replace(/<\/span>/g, ' ');
}

function remedyLatex(s: string) {
  return s.replace(/\$(\\[a-zA-Z]+)\$([0-9+-.]+)/g, '\${\\$1}$2\$')
          .replace(/\\micron/g, '\\mu{}m')
          .replace(/\\Msun/g, 'M_\\odot')
          .replace(/\\Mstar/g, 'M_\\ast')
          .replace(/_\*/g, '_\\ast')
          .replace(/_{\*}/g, '_{\\ast}')
          .replace(/\*/g, '\\*');
}