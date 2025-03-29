import { App, MarkdownRenderer, htmlToMarkdown, Modal, Notice, addIcon, Plugin, PluginSettingTab, Setting, sanitizeHTMLToDom, request, TFile, WorkspaceLeaf, Menu, Component, Vault, DataAdapter, Platform } from 'obsidian'; // Import Platform
import { FRView, VIEW_TYPE_FEEDS_READER } from "./view";
import { getFeedItems, RssFeedContent, RssFeedItem, nowdatetime, itemKeys, normalizeUrl } from "./getFeed";
import { GLB, FeedsReaderSettings } from "./globals";
import pako from 'pako';

// --- gzip related functions ---
async function compress(string: string): Promise<Uint8Array> {
    const encoder = new TextEncoder(); const data = encoder.encode(string); return pako.gzip(data);
}
async function decompress(byteArray: ArrayBuffer): Promise<string> {
    // Ensure input is ArrayBuffer
    if (!(byteArray instanceof ArrayBuffer)) {
        throw new Error("Decompression requires an ArrayBuffer.");
    }
    const data = pako.ungzip(new Uint8Array(byteArray)); const decoder = new TextDecoder(); return decoder.decode(data);
}


// --- default settings ---
const DEFAULT_SETTINGS: Partial<FeedsReaderSettings> = {
  feeds_reader_dir: 'feeds-reader', feeds_data_fname: 'feeds-data.json', subscriptions_fname: 'subscriptions.json',
  nItemPerPage: 20, saveContent: false, saveSnippetNewToOld: true,
  showJot: true, showSnippet: true, showRead: true, showSave: true, showMath: false, showGPT: false, showEmbed: true, showFetch: false, showLink: true, showDelete: true,
  defaultDisplayMode: 'card', cardWidth: 280, chatGPTAPIKey: '', chatGPTPrompt: 'Summarize the following text in 3 bullet points:',
};

// ============================================================
// --- Plugin Class Definition                              ---
// ============================================================
export default class FeedsReader extends Plugin {
	settings: FeedsReaderSettings;
    frViewInstance: FRView | null = null;

	async onload() {
		console.log('Loading Feeds Reader Plugin');
        await this.loadSettings();
        this.app.workspace.onLayoutReady(async () => {
            this.registerView(VIEW_TYPE_FEEDS_READER, (leaf) => { this.frViewInstance = new FRView(leaf); return this.frViewInstance; });
            // Check if icon already exists before adding
            if (!document.body.querySelector('div.app-container svg[data-icon-name="feeds-reader-icon"]')) {
                try {
                    addIcon("feeds-reader-icon", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="currentColor" d="M10 80 Q 50 80, 90 80" stroke="currentColor" stroke-width="8" fill="none"/><path fill="currentColor" d="M10 60 Q 35 60, 60 60" stroke="currentColor" stroke-width="8" fill="none"/><path fill="currentColor" d="M10 40 Q 20 40, 30 40" stroke="currentColor" stroke-width="8" fill="none"/><circle cx="15" cy="15" r="10" fill="currentColor"/></svg>`);
                    this.addRibbonIcon('feeds-reader-icon', 'Open Feeds Reader', () => this.activateView());
                 } catch (e) {
                      console.warn("Feeds Reader: Could not add ribbon icon.", e);
                 }
            } else {
                // Icon exists, just add ribbon action if needed (though usually done once)
                 this.addRibbonIcon('feeds-reader-icon', 'Open Feeds Reader', () => this.activateView());
            }
        });
        this.addSettingTab(new FeedReaderSettingTab(this.app, this));
        this.registerDomEvent(document, 'click', this.handleClick.bind(this));
        this.registerDomEvent(document, 'contextmenu', this.handleContextMenu.bind(this));
	}

	async onunload() { console.log('Unloading Feeds Reader Plugin'); await this.saveFeedsData(); this.app.workspace.detachLeavesOfType(VIEW_TYPE_FEEDS_READER); this.frViewInstance = null; }
    async activateView() { let leaf=this.app.workspace.getLeavesOfType(VIEW_TYPE_FEEDS_READER)[0]; if(!leaf){leaf=this.app.workspace.getLeaf('tab'); if(!leaf)leaf=this.app.workspace.getLeaf(false); if(!leaf){console.error("Feeds Reader: Failed to get leaf."); new Notice("Failed to open view."); return;} await leaf.setViewState({type:VIEW_TYPE_FEEDS_READER,active:true});} if(leaf)this.app.workspace.revealLeaf(leaf); }
	async loadSettings() {
        this.settings=Object.assign({},DEFAULT_SETTINGS,await this.loadData());
        // Populate GLB from settings
        GLB.feeds_reader_dir=this.settings.feeds_reader_dir;
        GLB.feeds_data_fname=this.settings.feeds_data_fname;
        GLB.subscriptions_fname=this.settings.subscriptions_fname;
        GLB.saved_snippets_fname='snippets.md';
        GLB.feeds_store_base='feeds-store';
        GLB.nItemPerPage=this.settings.nItemPerPage > 0 ? this.settings.nItemPerPage : 20;
        // Assign the whole settings object to GLB.settings for easy access
        GLB.settings = this.settings;
        // Remove direct assignments to GLB for settings that should be accessed via GLB.settings
        // GLB.saveContent=this.settings.saveContent; // REMOVED
        // GLB.saveSnippetNewToOld=this.settings.saveSnippetNewToOld; // REMOVED
        GLB.displayMode=this.settings.defaultDisplayMode || 'card';
        GLB.cardWidth=this.settings.cardWidth > 100 ? this.settings.cardWidth : 280;
        GLB.itemOrder='New to old'; // Default sort order
        GLB.filterMode='all';      // Default filter mode
        GLB.titleOnly=false;       // Default state
        GLB.currentFeed=null;
        GLB.currentFeedName='';
        GLB.nMergeLookback=10000;   // Default value
        GLB.lenStrPerFile=1024*1024*2; // Default value
        GLB.feedsStoreChange=false;
        GLB.feedsStoreChangeList=new Set<string>();
        GLB.elUnreadCount=null;
        GLB.elTotalCount=null;
        GLB.elSepUnreadTotal=null;
        GLB.maxTotalnumDisplayed=1e5; // Default value
        GLB.nThanksSep=16;          // Default value
        GLB.undoList=[];
        GLB.idxItemStart=0;
        GLB.nPage=1;
        GLB.displayIndices=[];
        GLB.starredItemsList=[];
    }
	async saveSettings() {
        // Update settings object from GLB state before saving
        this.settings.nItemPerPage=GLB.nItemPerPage;
        // Make sure to update settings from GLB.settings where applicable
        this.settings.saveContent=GLB.settings.saveContent;
        this.settings.saveSnippetNewToOld=GLB.settings.saveSnippetNewToOld;
        this.settings.defaultDisplayMode=GLB.displayMode;
        this.settings.cardWidth=GLB.cardWidth;
        // Ensure API key and prompt are saved correctly
        this.settings.chatGPTAPIKey = GLB.settings.chatGPTAPIKey;
        this.settings.chatGPTPrompt = GLB.settings.chatGPTPrompt;
        // Save other settings managed by the settings tab
        this.settings.showJot = GLB.settings.showJot;
        this.settings.showSnippet = GLB.settings.showSnippet;
        this.settings.showRead = GLB.settings.showRead;
        this.settings.showSave = GLB.settings.showSave;
        this.settings.showMath = GLB.settings.showMath;
        this.settings.showGPT = GLB.settings.showGPT;
        this.settings.showEmbed = GLB.settings.showEmbed;
        this.settings.showFetch = GLB.settings.showFetch;
        this.settings.showLink = GLB.settings.showLink;
        this.settings.showDelete = GLB.settings.showDelete;


        await this.saveData(this.settings);
    }

    getNumFromId(idstr: string | null | undefined, pref: string): number { if(!idstr)return -1; const n=pref.length; const num=idstr.substring(n); return /^\d+$/.test(num)?parseInt(num,10):-1; }

    // --- Event Handlers ---
    async handleClick(evt: MouseEvent) { const t=evt.target as HTMLElement; if(!t)return; if(t.closest('#updateAll')){await this.updateAllFeeds();return;} if(t.closest('#saveFeedsData')||t.closest('#save_data_toggling')){await this.handleSaveData();return;} if(t.closest('#addFeed')){new AddFeedModal(this.app,this).open();return;} if(t.closest('#manageFeeds')){new ManageFeedsModal(this.app,this).open();return;} if(t.closest('#search')){this.handleSearch();return;} if(t.closest('#undo')){this.handleUndo();return;} if(t.closest('#toggleOrder')){this.handleToggleOrder(t);return;} if(t.closest('.filter-item')){this.handleFilterChange(t.id);return;} if(t.closest('#showStarredItems')){this.handleShowAllStarred();return;} const sc=t.closest<HTMLElement>('.feed-stats'); if(sc){await this.handleRefreshSingleFeed(sc);return;} const fl=t.closest<HTMLElement>('.showFeed'); if(fl){this.handleShowFeed(fl.id);return;} if(t.closest('#toggleDisplayMode')){this.handleToggleDisplayMode(t);return;} if(t.closest('#refreshCurrentFeed')){await this.handleRefreshSingleFeed(t,true);return;} if(t.closest('#decreaseCardWidth')){this.adjustCardWidth(-20);return;} if(t.closest('#increaseCardWidth')){this.adjustCardWidth(20);return;} const ab=t.closest<HTMLElement>('.item-action-button, .item-action-star, .item-action-link'); const ie=t.closest<HTMLElement>('[data-idx][data-feedurl]'); if(ie){const idS=ie.getAttribute('data-idx'); const fu=ie.getAttribute('data-feedurl'); if(idS===null||fu===null)return; const idx=parseInt(idS); const tc=t.closest('.card-title a, .list-item-title a, .card-item:not(.card-actions *)'); if(tc&&ie.contains(tc)&&!ab){evt.preventDefault(); this.showItemContentInModal(idx,fu); return;} if(ab&&ie.contains(ab)){if(ab.classList.contains('item-action-star')){this.handleToggleStar(ab,idx,fu);return;} if(ab.classList.contains('toggleRead')){this.handleToggleRead(ab,idx,fu);return;} if(ab.classList.contains('toggleDelete')){this.handleToggleDelete(ab,idx,fu);return;} if(ab.classList.contains('jotNotes')){this.handleJotNotes(idx,fu);return;} if(ab.classList.contains('saveSnippet')){await this.handleSaveSnippet(idx,fu);return;} if(ab.classList.contains('noteThis')){await this.handleNoteThis(idx,fu);return;} if(ab.classList.contains('renderMath')){this.handleRenderMath(idx,fu);return;} if(ab.classList.contains('askChatGPT')){await this.handleAskChatGPT(idx,fu);return;} if(ab.classList.contains('elEmbedButton')){this.handleEmbed(idx,fu);return;} if(ab.classList.contains('elFetch')){await this.handleFetch(idx,fu);return;}}} if(t.closest('.markPageRead')){this.handleMarkPageReadOrDelete('read');return;} if(t.closest('.markPageDeleted')){this.handleMarkPageReadOrDelete('delete');return;} if(t.closest('.removePageContent')){this.handleRemovePageContent();return;} if(t.closest('#nextPage')){this.handlePageChange(1);return;} if(t.closest('#prevPage')){this.handlePageChange(-1);return;} if(t.closest('#toggleNavi')){this.handleToggleNavi(t);return;} }
    handleContextMenu(evt: MouseEvent) { const t=evt.target as HTMLElement; const fl=t.closest<HTMLElement>('.showFeed'); if(fl){evt.preventDefault(); const url=fl.id; const f=GLB.feedList.find(f=>f.feedUrl===url); if(!f)return; const m=new Menu(); m.addItem(i=>i.setTitle(`Update "${f.name}"`).setIcon("refresh-cw").onClick(async()=>{const s=fl.querySelector<HTMLElement>('.feed-stats'); if(s)await this.handleRefreshSingleFeed(s,false);})); m.addItem(i=>i.setTitle(`Mark all read`).setIcon("check-circle").onClick(async()=>{if(window.confirm(`Mark all in ${f.name} read?`)){this.markAllRead(url); await this.createFeedBar(); if(GLB.currentFeed===url)this.updateFeedStatsUI();}})); m.addItem(i=>i.setTitle(`Manage...`).setIcon("settings").onClick(()=>{new ManageFeedsModal(this.app,this).open();})); m.addSeparator(); m.addItem(i=>i.setTitle(`Copy URL`).setIcon("link").onClick(()=>{navigator.clipboard.writeText(url); new Notice("Copied!");})); m.showAtMouseEvent(evt); return;} const ie=t.closest<HTMLElement>('[data-idx][data-feedurl]'); if(ie){evt.preventDefault(); const idS=ie.getAttribute('data-idx'); const url=ie.getAttribute('data-feedurl'); if(idS===null||url===null)return; const idx=parseInt(idS); const item=GLB.feedsStore[url]?.items[idx]; if(!item)return; const m=new Menu(); m.addItem(i=>i.setTitle(item.read?"Unread":"Read").setIcon(item.read?"circle-off":"check-circle").onClick(()=>{const b=document.getElementById(`toggleRead${idx}`); if(b)this.handleToggleRead(b,idx,url);})); m.addItem(i=>i.setTitle(item.starred?"Unstar":"Star").setIcon(item.starred?"star-off":"star").onClick(()=>{const b=ie.querySelector<HTMLElement>('.item-action-star'); if(b)this.handleToggleStar(b,idx,url);})); if(item.link){m.addItem(i=>i.setTitle("Open Original").setIcon("external-link").onClick(()=>window.open(item.link!,'_blank'))); m.addItem(i=>i.setTitle("Copy Link").setIcon("link").onClick(()=>{navigator.clipboard.writeText(item.link!); new Notice("Copied!");}));} m.addSeparator(); m.addItem(i=>i.setTitle(item.deleted?"Undelete":"Delete").setIcon(item.deleted?"undo":"trash").onClick(()=>{const b=document.getElementById(`toggleDelete${idx}`); if(b)this.handleToggleDelete(b,idx,url);})); m.showAtMouseEvent(evt);} }

    // --- Specific Event Handler Implementations ---
    async handleSaveData() { try{const n=await this.saveFeedsData(); new Notice(n>0?`Saved ${n} chunk(s).`:"No changes.",1500);}catch(e){console.error("Save err:",e);new Notice("Save error.",2000);} }
    handleSearch() { if(!GLB.currentFeed)new Notice("Select feed.",3000); else if(GLB.currentFeed===GLB.STARRED_VIEW_ID)new Notice("Search N/A here.",3000); else new SearchModal(this.app).open(); }
    handleToggleNavi(target:HTMLElement) {
        const lp=document.getElementById('feedsReaderLeftPanel');
        if(!lp)return;
        const hid=lp.classList.contains('panel-hidden');

        // Toggle the class on the left panel
        lp.toggleClass('panel-hidden', !hid);

        // Update button text (optional, consider icons for mobile)
        if (target) {
            target.setText(hid ? '>' : '<');
        }

        // Desktop-specific logic (might be overridden by mobile CSS)
        const cb=document.getElementById('contentBox');
        const tc=document.getElementById('toggleNaviContainer');
        const aux=document.getElementById('toggleNaviAux');

        if (cb && tc && aux && !Platform.isMobile) { // Only run this part on desktop
            if (!hid) { // Panel is being hidden
                cb.removeClass('contentBoxRightpage');
                cb.addClass('contentBoxFullpage');
                tc.addClass('fixed');
                aux.empty();
                const sb=aux.createEl('span',{text:'Save',cls:'save_data_toggling'}); sb.id='save_data_toggling';
            } else { // Panel is being shown
                cb.addClass('contentBoxRightpage');
                cb.removeClass('contentBoxFullpage');
                tc.removeClass('fixed');
                aux.empty();
            }
        }
    }
    async handleRefreshSingleFeed(target:HTMLElement, forceCurrentViewUpdate:boolean=false) { const urlA=target.getAttribute('fdUrl'); const url=(urlA&&urlA!==GLB.STARRED_VIEW_ID)?urlA:(GLB.currentFeed&&GLB.currentFeed!==GLB.STARRED_VIEW_ID?GLB.currentFeed:null); if(url){const nameA=target.getAttribute('fdName'); const name=nameA||GLB.currentFeedName||url; new Notice(`Updating ${name}...`,1000); try{const[nNew,_]=await this.updateOneFeed(url); new Notice(`${name}: ${nNew} new.`,3000); await this.createFeedBar(); if(GLB.currentFeed===url||forceCurrentViewUpdate){this.makeDisplayList(); this.show_feed();} if(GLB.currentFeed===GLB.STARRED_VIEW_ID&&nNew>0){this.handleShowAllStarred(false);}}catch(e:any){console.error(`Update err ${name}:`,e); new Notice(`Update failed ${name}: ${e.message}`,3000);}} else if(target.closest('#refreshCurrentFeed')&&GLB.currentFeed===GLB.STARRED_VIEW_ID){new Notice("Cannot refresh Starred.",3000);}else{new Notice("Cannot find feed.",2000);}}
    handleShowFeed(feedUrl:string) { if(feedUrl===GLB.currentFeed||feedUrl===GLB.STARRED_VIEW_ID)return; const prev=GLB.currentFeed; GLB.currentFeed=feedUrl; if(!GLB.currentFeed)return; const f=GLB.feedList.find(f=>f.feedUrl===GLB.currentFeed); GLB.currentFeedName=f?f.name:'Unknown'; document.querySelectorAll('.showFeed, #showStarredItems').forEach(el=>el.removeClass('showingFeed')); document.getElementById(GLB.currentFeed)?.addClass('showingFeed'); if(prev!==GLB.currentFeed)GLB.undoList=[]; GLB.idxItemStart=0; GLB.nPage=1; if(prev!==GLB.STARRED_VIEW_ID){GLB.filterMode='all'; GLB.itemOrder='New to old'; document.querySelectorAll('.filter-item').forEach(el=>el.removeClass('filter-active')); document.getElementById('filterAll')?.addClass('filter-active'); const toggleOrderEl = document.getElementById('toggleOrder'); if (toggleOrderEl) toggleOrderEl.setText(`Sort: ${GLB.itemOrder}`);} this.makeDisplayList(); this.show_feed(); this.frViewInstance?.updateHeaderText(); }
    handleShowAllStarred(forceViewSwitch=true) { if(GLB.currentFeed===GLB.STARRED_VIEW_ID&&forceViewSwitch)return; const prev=GLB.currentFeed; GLB.currentFeed=GLB.STARRED_VIEW_ID; GLB.currentFeedName='Starred Items'; GLB.filterMode='starred'; GLB.itemOrder='New to old'; document.querySelectorAll('.showFeed').forEach(el=>el.removeClass('showingFeed')); document.getElementById('showStarredItems')?.addClass('showingFeed'); document.querySelectorAll('.filter-item').forEach(el=>el.removeClass('filter-active')); document.getElementById('filterStarred')?.addClass('filter-active'); const toggleOrderEl = document.getElementById('toggleOrder'); if (toggleOrderEl) toggleOrderEl.setText(`Sort: ${GLB.itemOrder}`); if(prev!==GLB.STARRED_VIEW_ID)GLB.undoList=[]; GLB.idxItemStart=0; GLB.nPage=1; this.makeDisplayList(); if(forceViewSwitch||GLB.currentFeed===GLB.STARRED_VIEW_ID){this.show_feed();} this.frViewInstance?.updateHeaderText(); console.log(`Show ${GLB.starredItemsList.length} starred.`); if(GLB.starredItemsList.length===0&&forceViewSwitch)new Notice("No starred items.",2000); }
    handleToggleDisplayMode(target:HTMLElement) { GLB.displayMode=GLB.displayMode==='list'?'card':'list'; target.setText(GLB.displayMode==='list'?'Card View':'List View'); this.settings.defaultDisplayMode=GLB.displayMode; this.saveSettings(); this.show_feed(); }
    adjustCardWidth(delta:number) { if(GLB.displayMode!=='card')return; const root=document.documentElement.style; let cur=parseInt(root.getPropertyValue('--card-item-width')||this.settings.cardWidth.toString()||'280'); let nW=Math.max(180,cur+delta); nW=Math.min(800,nW); root.setProperty('--card-item-width',`${nW}px`); GLB.cardWidth=nW; this.settings.cardWidth=nW; this.saveSettings(); }
    handleFilterChange(filterId:string) { const nf=filterId.replace('filter','').toLowerCase() as typeof GLB.filterMode; if(nf===GLB.filterMode)return; if(GLB.currentFeed===GLB.STARRED_VIEW_ID&&nf!=='starred'){new Notice(`Only 'Starred' filter here.`,3000); document.getElementById(filterId)?.removeClass('filter-active'); document.getElementById('filterStarred')?.addClass('filter-active'); return;} document.querySelectorAll('.filter-item').forEach(el=>el.removeClass('filter-active')); document.getElementById(filterId)?.addClass('filter-active'); GLB.filterMode=nf; if(GLB.currentFeed){GLB.idxItemStart=0; GLB.nPage=1; this.makeDisplayList(); this.show_feed();} }
    handleToggleOrder(target:HTMLElement) { if(GLB.itemOrder==='New to old')GLB.itemOrder='Old to new'; else if(GLB.itemOrder==='Old to new')GLB.itemOrder='Random'; else GLB.itemOrder='New to old'; target.setText(`Sort: ${GLB.itemOrder}`); if(GLB.currentFeed){this.makeDisplayList(); this.show_feed();} }
    handlePageChange(delta:number) { const tot=(GLB.currentFeed===GLB.STARRED_VIEW_ID)?GLB.starredItemsList.length:GLB.displayIndices.length; const nS=GLB.idxItemStart+delta*GLB.nItemPerPage; if(nS>=0&&nS<tot){GLB.idxItemStart=nS; GLB.nPage+=delta; this.show_feed(); document.getElementById('feed_content')?.scrollTo(0,0);} else if(delta>0&&GLB.idxItemStart+GLB.nItemPerPage>=tot){new Notice("Last page.",1500);} else if(delta<0&&GLB.nPage<=1){new Notice("First page.",1500);} }

    // --- Item Actions ---
    handleToggleStar(target:HTMLElement, idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item)return; const was=item.starred; item.starred=!item.starred; target.setText(item.starred?'★':'☆'); target.toggleClass('starred',item.starred); target.closest('[data-idx]')?.toggleClass('starred-item',item.starred); GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl); if(GLB.currentFeed===GLB.STARRED_VIEW_ID){const i=GLB.starredItemsList.findIndex(si=>si.feedUrl===feedUrl&&si.originalIndex===idx); if(i>-1&&!item.starred){GLB.starredItemsList.splice(i,1); this.show_feed();} else if(i===-1&&item.starred){this.handleShowAllStarred(false);}} else if(GLB.filterMode==='starred'){this.makeDisplayList(); this.show_feed();} this.addUndoAction(feedUrl,idx,{starred:was}); }
    handleToggleRead(target:HTMLElement, idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item)return; const prev={read:item.read,deleted:item.deleted}; let c=false; if(!item.read){if(item.deleted)item.deleted=null; item.read=nowdatetime(); target.setText('Unread'); const el = target.closest('[data-idx]'); if(el){el.addClass('read'); el.removeClass('deleted');} document.getElementById(`toggleDelete${idx}`)?.setText('Delete'); c=true;} else{item.read=null; target.setText('Read'); target.closest('[data-idx]')?.removeClass('read'); c=true;} if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl); this.updateFeedStatsUI(); this.updateItemVisibility(item,idx,feedUrl); this.addUndoAction(feedUrl,idx,prev);} }
    handleToggleDelete(target:HTMLElement, idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item)return; const prev={read:item.read,deleted:item.deleted}; let c=false; if(!item.deleted){if(item.read)item.read=null; item.deleted=nowdatetime(); target.setText('Undelete'); const el=target.closest('[data-idx]'); if(el){el.addClass('deleted'); el.removeClass('read');} document.getElementById(`toggleRead${idx}`)?.setText('Read'); c=true;} else{item.deleted=null; target.setText('Delete'); target.closest('[data-idx]')?.removeClass('deleted'); c=true;} if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl); if(GLB.currentFeed===GLB.STARRED_VIEW_ID){const i=GLB.starredItemsList.findIndex(si=>si.feedUrl===feedUrl&&si.originalIndex===idx); if(i>-1){GLB.starredItemsList.splice(i,1); this.show_feed();}} else{this.updateFeedStatsUI(); this.updateItemVisibility(item,idx,feedUrl);} this.addUndoAction(feedUrl,idx,prev);} }
    handleJotNotes(idx:number, feedUrl:string) { const cId=`shortNoteContainer_${feedUrl}_${idx}`; let nC=document.getElementById(cId); const iE=document.querySelector(`[data-idx="${idx}"][data-feedurl="${feedUrl}"]`); const aC=document.getElementById(`actionContainer${idx}`); if(nC){nC.style.display=nC.style.display==='none'?'block':'none'; const ta=nC.querySelector('textarea'); if(ta)ta.focus();} else if(iE){nC=iE.createDiv({cls:'short-note-container'}); nC.id=cId; const sN=nC.createEl('textarea',{cls:'shortNote'}); sN.id=`shortNote_${feedUrl}_${idx}`; sN.rows=3; sN.placeholder='Jot notes...'; if(aC)iE.insertBefore(nC,aC); else iE.appendChild(nC); sN.focus();} }
    async handleSaveSnippet(idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item)return; const sp=`${GLB.feeds_reader_dir}/${GLB.saved_snippets_fname}`; try{if(!await this.app.vault.adapter.exists(GLB.feeds_reader_dir)) await this.app.vault.createFolder(GLB.feeds_reader_dir); const l=item.link||''; let snC=(document.getElementById(`shortNote_${feedUrl}_${idx}`) as HTMLTextAreaElement)?.value.trim()||''; const d=`\n> <small>${formatDate(item.pubDate||item.downloaded)}</small>`; const fN=GLB.feedsStore[feedUrl]?.name?`\n> <small>${GLB.feedsStore[feedUrl].name}</small>`:''; let ct=''; if(this.settings.saveContent&&item.content){let a=item.creator?`\n> Author: ${htmlToMarkdown(item.creator)}`:''; try{ct=remedyLatex(htmlToMarkdown(item.content))+a;}catch(e){ct="[Content Error]"+a;}} const t=item.title?.trim().replace(/(<([^>]+)>)/gi," ")||'No Title'; const sc:string=`${snC?snC+'\n':''}> [!abstract]- [${t}](${l})\n> ${ct}${d}${fN}`; let fe=await this.app.vault.adapter.exists(sp); let fc=fe?await this.app.vault.adapter.read(sp):''; if(fe&&fc.includes(l)){new Notice("URL exists in snippets.",1500); return;} const cw=fe?(this.settings.saveSnippetNewToOld?`${sc}\n\n<hr>\n\n${fc}`:`${fc}\n\n<hr>\n\n${sc}`):sc; await this.app.vault.adapter.write(sp,cw); new Notice(`Snippet ${fe?'appended':'saved'}.`,1500); } catch(e){console.error("Save Snip Err:",e); new Notice("Save snippet err.",2000);} }
    async handleNoteThis(idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item)return; const nd=GLB.feeds_reader_dir; try{if(!await this.app.vault.adapter.exists(nd))await this.app.vault.createFolder(nd); const l=item.link||''; let dff:string=(item.pubDate||item.downloaded||nowdatetime()).substring(0,10); const tff=item.title?.trim().replace(/(<([^>]+)>)/gi," ").substring(0,50)||'No Title'; const nff=GLB.feedsStore[feedUrl]?.name?str2filename(GLB.feedsStore[feedUrl].name)+'-':''; const fb:string=str2filename(`${dff}-${nff}${tff}`); let fn=`${fb}.md`; let ctr=0; while(await this.app.vault.adapter.exists(`${nd}/${fn}`)){fn=`${fb}-${++ctr}.md`;} const fp:string=`${nd}/${fn}`; let snC=(document.getElementById(`shortNote_${feedUrl}_${idx}`) as HTMLTextAreaElement)?.value.trim()||''; let ct=''; if(this.settings.saveContent&&item.content){let a=item.creator?`\n\nAuthor: ${htmlToMarkdown(item.creator)}`:''; try{ct=remedyLatex(htmlToMarkdown(item.content))+a;}catch(e){ct="[Content Error]"+a;}} const t=item.title?.trim().replace(/(<([^>]+)>)/gi," ")||'No Title'; const d=formatDate(item.pubDate||item.downloaded); const fc:string=`---
feed: ${GLB.feedsStore[feedUrl]?.name||'Unknown'}
url: ${l}
date: ${item.pubDate||item.downloaded}
starred: ${item.starred||false}
tags: [rss, feed]
---
# [${t}](${l})

*Date: ${d}*
${item.creator?`*Author: ${item.creator}*\n`:''}
${snC?`## Notes\n\n${snC}\n\n---\n`:''}
${ct?`## Content\n\n${ct}`:''}
`; await this.app.vault.create(fp,fc); new Notice(`${fn} saved.`,1500); } catch(e){console.error("Save Note Err:",e); new Notice("Save note err.",2000);} }
    handleRenderMath(idx: number, feedUrl: string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item?.content)return; new MathRenderModal(this.app,item,this).open(); }
    async handleAskChatGPT(idx: number, feedUrl: string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item?.content){new Notice("No content.",1500); return;} const key=this.settings.chatGPTAPIKey; const prmpt=this.settings.chatGPTPrompt; if(!key||!prmpt){new Notice("GPT Key/Prompt not set.",2000); return;} new ChatGPTInteractionModal(this.app,item,key,prmpt,this).open(); }
    handleEmbed(idx: number, feedUrl: string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item?.link){new Notice("No link.",1500); return;} new EmbedModal(this.app,item.link,item.title).open(); }
    async handleFetch(idx: number, feedUrl: string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; if(!item?.link){new Notice("No link.",1500); return;} new FetchContentModal(this.app,item.link,item.title).open(); }

    // --- Undo Logic ---
    addUndoAction(feedUrl: string, index: number, previousState: Partial<RssFeedItem>) { GLB.undoList.unshift({ feedUrl, index, previousState }); if(GLB.undoList.length>50)GLB.undoList.pop(); }
    handleUndo() { if(GLB.undoList.length===0){new Notice("Nothing to undo.",1000); return;} const last=GLB.undoList.shift(); if(!last)return; const{feedUrl,index,previousState}=last; if(!GLB.feedsStore[feedUrl]?.items[index]){console.warn("Undo: Item not found."); return;} const item=GLB.feedsStore[feedUrl].items[index]; let restored=false; for(const k in previousState){if(previousState.hasOwnProperty(k)){(item as any)[k]=(previousState as any)[k]; restored=true;}} if(restored){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl); new Notice("Action undone.",1000); this.createFeedBar(); if(GLB.currentFeed===feedUrl){this.updateFeedStatsUI(); const el=document.querySelector(`[data-idx="${index}"][data-feedurl="${feedUrl}"]`); if(el){const rBtn=el.querySelector<HTMLElement>(`.toggleRead`); if(rBtn)rBtn.setText(item.read?'Unread':'Read'); const dBtn=el.querySelector<HTMLElement>(`.toggleDelete`); if(dBtn)dBtn.setText(item.deleted?'Undelete':'Delete'); const sBtn=el.querySelector<HTMLElement>(`.item-action-star`); if(sBtn){sBtn.setText(item.starred?'★':'☆'); sBtn.toggleClass('starred',!!item.starred);} el.toggleClass('read',!!item.read); el.toggleClass('deleted',!!item.deleted); el.toggleClass('starred-item',!!item.starred); this.updateItemVisibility(item,index,feedUrl);} else{this.show_feed();}} else if(GLB.currentFeed===GLB.STARRED_VIEW_ID){this.handleShowAllStarred(false);}} else{new Notice("Could not restore state.",1500);} }

    // --- Page Actions ---
    handleMarkPageReadOrDelete(action:'read'|'delete'){ let items: { feedUrl: string, index: number }[]=[]; const start=GLB.idxItemStart; let end: number; if(GLB.currentFeed===GLB.STARRED_VIEW_ID){end=Math.min(GLB.starredItemsList.length,start+GLB.nItemPerPage); for(let i=start;i<end;i++)items.push({feedUrl:GLB.starredItemsList[i].feedUrl, index:GLB.starredItemsList[i].originalIndex});} else if(GLB.currentFeed){end=Math.min(GLB.displayIndices.length,start+GLB.nItemPerPage); for(let i=start;i<end;i++)items.push({feedUrl:GLB.currentFeed, index:GLB.displayIndices[i]});} else return; const now=nowdatetime(); let changed=false; let nMarked=0; const undoItems:{feedUrl:string,index:number,previousState:Partial<RssFeedItem>}[]=[]; items.forEach(({feedUrl,index})=>{ const item=GLB.feedsStore[feedUrl]?.items[index]; if(!item)return; const current={read:item.read,deleted:item.deleted}; let itemChanged=false; if(action==='read'){if(!item.read){if(item.deleted)item.deleted=null; item.read=now; itemChanged=true;}} else{if(!item.deleted){if(item.read)item.read=null; item.deleted=now; itemChanged=true;}} if(itemChanged){changed=true; nMarked++; undoItems.push({feedUrl,index,previousState:current}); GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}); if(changed){new Notice(`${nMarked} item(s) marked ${action}.`,1500); undoItems.reverse().forEach(u=>this.addUndoAction(u.feedUrl,u.index,u.previousState)); this.updateFeedStatsUI(); this.createFeedBar(); this.makeDisplayList(); this.show_feed();} else{new Notice(`No items needed marking.`,1000);} }
    handleRemovePageContent() { if(GLB.currentFeed===GLB.STARRED_VIEW_ID){new Notice("Cannot remove content here.",2000); return;} if(!GLB.currentFeed||!GLB.feedsStore[GLB.currentFeed])return; if(!window.confirm("Remove content on THIS PAGE? Cannot be undone.")) return; const fd=GLB.feedsStore[GLB.currentFeed]; let changed=false; const start=GLB.idxItemStart; const end=Math.min(GLB.displayIndices.length,start+GLB.nItemPerPage); for(let i=start;i<end;i++){const idx=GLB.displayIndices[i]; const item=fd.items[idx]; if(!item)continue; let iChanged=false; if(item.hasOwnProperty('content')){delete (item as Partial<RssFeedItem>).content; iChanged=true;} if(item.hasOwnProperty('creator')){delete (item as Partial<RssFeedItem>).creator; iChanged=true;} if(iChanged)changed=true;} if(changed){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(GLB.currentFeed); new Notice("Content removed.",1500); this.show_feed();} else{new Notice("No content removed.",1000);} }

    // --- UI Update Helpers ---
    updateItemVisibility(item:RssFeedItem, idx:number, feedUrl:string) { const el=document.querySelector(`[data-idx="${idx}"][data-feedurl="${feedUrl}"]`); if(!el)return; let vis=true; if(GLB.filterMode==='unread'&&(item.read||item.deleted))vis=false; else if(GLB.filterMode==='starred'&&!item.starred)vis=false; else if(item.deleted&&GLB.filterMode!=='all')vis=false; else if(item.deleted&&GLB.filterMode==='all'){el.addClass('deleted-visible'); vis=true;} el.toggleClass('hidedItem',!vis); if(!vis)el.removeClass('deleted-visible'); }
    updateFeedStatsUI() { if(!GLB.currentFeed||GLB.currentFeed===GLB.STARRED_VIEW_ID)return; const stats=this.getFeedStats(GLB.currentFeed); const ucEl=document.getElementById(`unreadCount${GLB.currentFeed}`); if(ucEl)ucEl.innerText=stats.unread.toString(); const tcEl=document.getElementById(`totalCount${GLB.currentFeed}`); const sepEl=document.getElementById(`sepUnreadTotal${GLB.currentFeed}`); if(tcEl&&sepEl){if(stats.total<GLB.maxTotalnumDisplayed){tcEl.innerText=stats.total.toString(); sepEl.style.display='';}else{tcEl.innerText=''; sepEl.style.display='none';}} }

    // --- Modal Window Launchers ---
    showItemContentInModal(idx:number, feedUrl:string) { const item=GLB.feedsStore[feedUrl]?.items[idx]; const feedName=GLB.feedsStore[feedUrl]?.name||'Unknown'; if(!item)return; new ItemContentModal(this.app,item,feedName,this).open(); }

    // --- Feed Update ---
     async updateAllFeeds() { new Notice("Starting all feeds update...",2000); let totalNew=0; const promises=GLB.feedList.map(async(f)=>{try{const[nNew,_]=await this.updateOneFeed(f.feedUrl); if(nNew>0)totalNew+=nNew;}catch(e:any){console.error(`Update fail ${f.name}:`,e); new Notice(`Update failed: ${f.name}`,2000);}}); await Promise.allSettled(promises); new Notice(`Update finished. ${totalNew} new items found.`,totalNew>0?3000:1500); await this.createFeedBar(); if(GLB.currentFeed===GLB.STARRED_VIEW_ID)this.handleShowAllStarred(false); else if(GLB.currentFeed){this.makeDisplayList(); this.show_feed();} }

    // --- Feed Data Handling (Moved inside class) ---
    async loadSubscriptions() { await loadSubscriptions(this.app.vault.adapter); }
    // Use app.vault for folder creation
    async saveSubscriptions() { await saveSubscriptions(this.app, this.app.vault.adapter); }
    // Corrected: Remove argument from call to standalone createFeedBar
    async createFeedBar() { await createFeedBar(); }
    async saveFeedsData(): Promise<number> {
        // Ensure base folder exists before saving chunks
        const folder = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
        try {
            if (!await this.app.vault.adapter.exists(folder)) {
                await this.app.vault.createFolder(folder);
                console.log(`Created feed store folder: ${folder}`);
            }
        } catch (e) {
            console.error(`Error ensuring feed store folder exists (${folder}):`, e);
            new Notice("Error creating feed store directory. Cannot save data.", 5000);
            return 0; // Prevent further save attempts if folder fails
        }
        // Pass app to saveStringSplitted (indirectly via saveStringToFileGzip/saveStringToFile)
        return saveFeedsData(this.app, this.app.vault.adapter);
    }
    async loadFeedsStoredData() { await loadFeedsStoredData(this.app.vault.adapter); }
    async loadOldCombinedDataFile() { await loadOldCombinedDataFile(this.app.vault.adapter); }
    mergeStoreWithNewData(newdata: RssFeedContent, key: string): number { return mergeStoreWithNewData(newdata, key); }
    // Pass app to updateOneFeed -> saveFeedsData
    async updateOneFeed(feedUrl: string): Promise<[number, number]> { return updateOneFeed(this.app, feedUrl, this.app.vault.adapter); }

    // --- Display List & View Rendering (Moved inside class) ---
    makeDisplayList() { makeDisplayList(); }
    show_feed() { show_feed(this.app, this); }
    createPageActionButtons(container: HTMLElement, hasItems: boolean) { createPageActionButtons(container, hasItems); }
    createPagination(container: HTMLElement, totalItems: number) { createPagination(container, totalItems); }
    createCardItem(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) { createCardItem(this.app, container, item, originalIndex, feedUrl, isStarredView); } // Pass app
    createListItem(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, isStarredView: boolean) { createListItem(this.app, container, item, originalIndex, feedUrl, isStarredView); } // Pass app
    createActionButtons(container: HTMLElement, item: RssFeedItem, originalIndex: number, feedUrl: string, viewType: 'list' | 'card') { createActionButtons(container, item, originalIndex, feedUrl, viewType); }

    // --- Statistics (Moved inside class) ---
    getFeedStats(feedUrl: string): { total: number; read: number; deleted: number; unread: number; starred: number } { return getFeedStats(feedUrl); }
    getFeedStorageInfo(feedUrl: string): [string, string, number, number] { return getFeedStorageInfo(feedUrl); }

    // --- Feed Management Actions (Moved inside class) ---
    markAllRead(feedUrl: string) { markAllRead(feedUrl); }
    purgeDeleted(feedUrl: string) { purgeDeleted(feedUrl); }
    removeContent(feedUrl: string) { removeContent(feedUrl); }
    removeEmptyFields(feedUrl: string) { removeEmptyFields(feedUrl); }
    removeContentOld(feedUrl: string) { removeContentOld(feedUrl); }
    purgeAll(feedUrl: string) { purgeAll(feedUrl); }
    purgeOldHalf(feedUrl: string) { purgeOldHalf(feedUrl); }
    deduplicate(feedUrl: string): number { return deduplicate(feedUrl); }
    // Pass app to removeFeed -> saveSubscriptions
    async removeFeed(feedUrl: string) { await removeFeed(this.app, this.app.vault.adapter, feedUrl, this); }

    // --- File I/O Helpers (Moved inside class) ---
    makeFilename(fname_base: string, iPostfix: number): string { return makeFilename(fname_base, iPostfix); }
    // Pass app to saveStringToFileGzip -> saveStringToFile for folder creation
    async saveStringToFileGzip(s: string, folder: string, fname: string): Promise<boolean> { return saveStringToFileGzip(this.app, this.app.vault.adapter, s, folder, fname); }
    // Pass app to saveStringToFile for folder creation
    async saveStringToFile(s: string, folder: string, fname: string): Promise<boolean> { return saveStringToFile(this.app, this.app.vault.adapter, s, folder, fname); }
    // Pass app to saveStringSplitted -> saveStringToFileGzip/saveStringToFile
    async saveStringSplitted(s: string, folder: string, fname_base: string, nCharPerFile: number): Promise<number> { return saveStringSplitted(this.app, this.app.vault.adapter, s, folder, fname_base, nCharPerFile); }
    async loadStringSplitted_Gzip(folder: string, fname_base: string): Promise<string> { return loadStringSplitted_Gzip(this.app.vault.adapter, folder, fname_base); }
    async loadStringSplitted(folder: string, fname_base: string): Promise<string> { return loadStringSplitted(this.app.vault.adapter, folder, fname_base); }

} // --- End of FeedsReader class ---


// ============================================================
// --- Global Helper Functions & Modal Definitions          ---
// ============================================================
// Moved implementations inside the class or made them accept adapter/app

// --- Feed Data Handling ---
async function loadSubscriptions(adapter: DataAdapter) { const p=`${GLB.feeds_reader_dir}/${GLB.subscriptions_fname}`; GLB.feedList=[]; try{if(await adapter.exists(p)){const d=await adapter.read(p); if(d){GLB.feedList=JSON.parse(d); if(!Array.isArray(GLB.feedList))throw new Error("Not array."); GLB.feedList=GLB.feedList.filter(f=>f?.name&&f.feedUrl);}}}catch(e:any){console.error("Load Sub Error:",e); new Notice(`Load Subs Error: ${e.message}`,3000); GLB.feedList=[];} sort_feed_list(); }
// Modified: Accept App object to access vault for createFolder
async function saveSubscriptions(app: App, adapter: DataAdapter) {
    const d = GLB.feeds_reader_dir;
    const p = `${d}/${GLB.subscriptions_fname}`;
    try {
        // Use app.vault.createFolder for directory creation
        if (!await adapter.exists(d)) await app.vault.createFolder(d);
        const v = GLB.feedList.filter(f => f?.name && f.feedUrl);
        await adapter.write(p, JSON.stringify(v, null, 2));
    } catch (e: any) {
        console.error("Save Subs Error:", e);
        new Notice(`Save Subs Error: ${e.message}`, 2000);
    }
}
async function createFeedBar() {
    // Cast to HTMLTableElement after null check
    const t = document.getElementById('feedTable') as HTMLTableElement | null;
    if (!t) return;
    t.empty();
    let cur = "%%%NO_FOLDER_YET%%%";
    if (!GLB.feedList?.length) {
        t.createEl('tr').createEl('td').setText('No feeds.');
        return;
    }
    // Use createTBody on the table element
    const b = t.createTBody();
    GLB.feedList.forEach(i => {
        if (!i?.feedUrl || !i.name) return;
        const fld = i.folder || "";
        if (fld !== cur) {
            cur = fld;
            const r = b.createEl('tr', { cls: 'feedFolderRow' });
            const c = r.createEl('td');
            c.colSpan = 2;
            c.createEl('span', { text: cur || "Uncategorized", cls: 'feedFolder' }); // Changed "Uncat."
        }
        const tr = b.createEl('tr');
        const nTd = tr.createEl('td');
        const sF = nTd.createEl('span', { cls: 'showFeed' });
        sF.id = i.feedUrl;
        if (i.feedUrl === GLB.currentFeed) sF.addClass('showingFeed');
        sF.createSpan({ text: i.name, cls: 'feed-name' });
        const sC = sF.createSpan({ cls: 'feed-stats' });
        sC.setAttrs({ 'fdUrl': i.feedUrl, 'fdName': i.name });
        const s = getFeedStats(i.feedUrl);
        const uc = sC.createEl('span', { text: s.unread.toString(), cls: 'unreadCount' });
        uc.id = `unreadCount${i.feedUrl}`;
        if (s.total < GLB.maxTotalnumDisplayed) {
            const sep = sC.createEl('span', { text: '/', cls: 'unreadCountSep' });
            sep.id = `sepUnreadTotal${i.feedUrl}`;
            const tc = sC.createEl('span', { text: s.total.toString(), cls: 'totalCount' });
            tc.id = `totalCount${i.feedUrl}`;
        }
    });
}

// Modified: Accept App object for folder creation check before saving chunks
async function saveFeedsData(app: App, adapter: DataAdapter): Promise<number> {
    let nS = 0;
    if (!GLB.feedsStoreChange || GLB.feedsStoreChangeList.size === 0) return 0;

    // Folder check moved to the calling class method (FeedsReader.saveFeedsData)

    const p: Promise<number>[] = [];
    const ch = Array.from(GLB.feedsStoreChangeList);
    for (const k of ch) {
        const i = GLB.feedList.find(f => f.feedUrl === k);
        const n = i?.name;
        if (!GLB.feedsStore[k]) { console.warn(`Save Skip: Feed data missing for ${k}`); continue; }
        if (!n) { console.warn(`Save Skip (no name associated): ${k}`); continue; }
        try {
            const dS = JSON.stringify(GLB.feedsStore[k]);
            // Pass app down to saveStringSplitted
            p.push(saveStringSplitted(app, adapter, dS, `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`, n, GLB.lenStrPerFile));
        } catch (e) { console.error(`Stringify error for feed ${n} (${k}):`, e); }
    }
    const res = await Promise.allSettled(p);
    res.forEach(r => { if (r.status === 'fulfilled') nS += r.value; else console.error("Save chunk error:", r.reason); });
    GLB.feedsStoreChange = false;
    GLB.feedsStoreChangeList.clear();
    if (nS > 0) console.log(`Saved ${nS} chunks.`);
    return nS;
}
async function loadFeedsStoredData(adapter: DataAdapter) { GLB.feedsStore={}; if(!GLB.feedList)return; const p=GLB.feedList.map(async(f)=>{const dir=`${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`; try{let res=await loadStringSplitted_Gzip(adapter,dir,f.name); let gz=true; if(res===''){res=await loadStringSplitted(adapter,dir,f.name); gz=false;} if(res){try{const d:RssFeedContent=JSON.parse(res); d.name=f.name; d.folder=f.folder || ''; if(d?.items){d.items.forEach(i=>{if(i){i.starred??=false; if(i.read==='')i.read=null; if(i.deleted==='')i.deleted=null; i.downloaded??=nowdatetime();}}); d.items=d.items.filter(Boolean);}else d.items=[]; GLB.feedsStore[f.feedUrl]=d; if(!gz){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(f.feedUrl);}}catch(e:any){console.error(`Parse Err ${f.name}:`,e,res.substring(0,200)); new Notice(`Parse error: ${f.name}`,3000);}}else console.log(`No stored data found for feed: ${f.name}`);}catch(e:any){console.error(`Load Err ${f.name}:`,e); new Notice(`Load error: ${f.name}`,3000);}}); await Promise.allSettled(p); console.log("Feed data loading process completed."); await loadOldCombinedDataFile(adapter); }
async function loadOldCombinedDataFile(adapter: DataAdapter) { const op=`${GLB.feeds_reader_dir}/${GLB.feeds_data_fname}`; try{if(await adapter.exists(op)){new Notice(`Loading legacy data file...`,5000); const od=await adapter.read(op); if(od){const p=JSON.parse(od); for(const u in p){if(!GLB.feedsStore[u]&&p.hasOwnProperty(u)){const i=GLB.feedList.find(f=>f.feedUrl===u); const d=p[u] as RssFeedContent; if(d?.items){d.name=i?.name||u; d.folder=i?.folder||''; d.items.forEach(it=>{if(it){it.starred??=false; if(it.read==='')it.read=null; if(it.deleted==='')it.deleted=null; it.downloaded??=nowdatetime();}}); d.items=d.items.filter(Boolean); GLB.feedsStore[u]=d; GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(u);}else console.warn(`Invalid legacy data structure for: ${u}`);}} // Optionally remove the old file after successful migration
        // Consider adding a confirmation or setting before removing
        // console.log("Attempting to remove legacy data file:", op);
        // await adapter.remove(op);
        // new Notice("Legacy data migrated and file removed.", 2000);
        }
      }
    }catch(e:any){console.error("Legacy load error:",e); new Notice(`Legacy load error: ${e.message}`,3000);} }
function mergeStoreWithNewData(newdata:RssFeedContent, key:string):number{ if(!newdata?.items)return 0; if(!GLB.feedsStore[key]){const i=GLB.feedList.find(f=>f.feedUrl===key); newdata.name=i?.name||key; newdata.folder=i?.folder||''; newdata.items.forEach(it=>{if(it){it.starred??=false; it.read=null; it.deleted=null; it.downloaded??=nowdatetime();}}); GLB.feedsStore[key]=newdata; GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(key); return newdata.items.length;} const ex=GLB.feedsStore[key]; ex.title=newdata.title||ex.title; ex.subtitle=newdata.subtitle||ex.subtitle; ex.description=newdata.description||ex.description; ex.pubDate=newdata.pubDate||ex.pubDate; if(newdata.image)ex.image=newdata.image; let nNew=0; const exL=new Set(ex.items.slice(0,GLB.nMergeLookback).map(i=>i?.link).filter(Boolean)); const toAdd:RssFeedItem[]=[]; for(let j=newdata.items.length-1;j>=0;j--){const nI=newdata.items[j]; if(!nI)continue; if(nI.link&&!exL.has(nI.link)){nI.starred=false; nI.read=null; nI.deleted=null; nI.downloaded??=nowdatetime(); toAdd.push(nI); nNew++;}else if(!nI.link)console.warn(`Skip new item with no link: ${key}`);} if(nNew>0){ex.items.unshift(...toAdd); GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(key);} return nNew; }
// Modified: Accept app for saveFeedsData call
async function updateOneFeed(app: App, feedUrl: string, adapter: DataAdapter): Promise<[number, number]> {
    let nN = 0, nT = 0;
    try {
        const r = await getFeedItems(feedUrl);
        if (r?.items) {
            nN = mergeStoreWithNewData(r, feedUrl);
            nT = GLB.feedsStore[feedUrl]?.items?.length || 0;
            // Pass app to saveFeedsData if new items were added
            if (nN > 0) await saveFeedsData(app, adapter);
        } else {
            nT = GLB.feedsStore[feedUrl]?.items?.length || 0;
        }
    } catch (e: any) {
        console.error(`UpdateOneFeed Err ${feedUrl}:`, e);
        throw e;
    }
    return [nN, nT];
}


// --- Display List Generation & Sorting ---
function makeDisplayList() { GLB.displayIndices=[]; GLB.starredItemsList=[]; if(GLB.currentFeed===GLB.STARRED_VIEW_ID){for(const url in GLB.feedsStore){if(GLB.feedsStore.hasOwnProperty(url)){const f=GLB.feedsStore[url]; if(f?.items){f.items.forEach((i,idx)=>{if(i?.starred&&!i.deleted)GLB.starredItemsList.push({feedUrl:url,originalIndex:idx,item:i});});}}} GLB.starredItemsList.sort((a,b)=>{const dA=new Date(a.item.pubDate||a.item.downloaded||0).getTime(); const dB=new Date(b.item.pubDate||b.item.downloaded||0).getTime(); return(GLB.itemOrder==='Old to new')?dA-dB:dB-dA;});} else if(GLB.currentFeed&&GLB.feedsStore[GLB.currentFeed]){const fd=GLB.feedsStore[GLB.currentFeed]; if(!fd?.items)return; for(let i=0; i<fd.items.length; i++){const item=fd.items[i]; if(!item)continue; let d=false; switch(GLB.filterMode){case 'all':d=!item.deleted;break; case 'unread':d=!item.read&&!item.deleted;break; case 'starred':d=!!item.starred&&!item.deleted;break; default:d=!item.deleted;} if(d)GLB.displayIndices.push(i);} if(GLB.itemOrder==='Old to new')GLB.displayIndices.reverse();} if(GLB.itemOrder==='Random'){const list=(GLB.currentFeed===GLB.STARRED_VIEW_ID)?GLB.starredItemsList:GLB.displayIndices; for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [list[i],list[j]]=[list[j],list[i]];}} }
function sort_feed_list() { if (!GLB.feedList) return; GLB.feedList.sort((a, b) => { const fA = a.folder || "zzz"; const fB = b.folder || "zzz"; if (fA < fB) return -1; if (fA > fB) return 1; const nA = a.name || ""; const nB = b.name || ""; return nA.localeCompare(nB); }); }

// --- Main View Rendering ---
function show_feed(app: App, plugin: FeedsReader) { const fE=document.getElementById('feed_content'); const hE=document.getElementById('contentHeader'); if(!fE||!hE)return; fE.empty(); hE.empty(); const iS=GLB.currentFeed===GLB.STARRED_VIEW_ID; const list=iS?GLB.starredItemsList:GLB.displayIndices; let fD:RssFeedContent|null=null; if(!iS&&GLB.currentFeed)fD=GLB.feedsStore[GLB.currentFeed]; const tH=hE.createEl('h2'); tH.addClass('feed-title-header'); if(iS)tH.setText('★ Starred Items'); else if(fD){if(fD.link)tH.createEl('a',{href:fD.link,text:fD.title||GLB.currentFeedName, attr: {target: '_blank', rel: 'noopener noreferrer'}}); else tH.setText(fD.title||GLB.currentFeedName);} else tH.setText('Select Feed'); const acts=hE.createDiv({cls:'header-actions'}); if(!iS&&GLB.currentFeed){const r=acts.createEl('button',{text:'Refresh'}); r.id='refreshCurrentFeed';} const v=acts.createEl('button',{text:GLB.displayMode==='list'?'Card View':'List View'}); v.id='toggleDisplayMode'; if(GLB.displayMode==='card'){const wd=acts.createEl('button',{text:'W-'}); wd.id='decreaseCardWidth'; const wi=acts.createEl('button',{text:'W+'}); wi.id='increaseCardWidth';} const tA=fE.createDiv({cls:'page-actions top-page-actions'}); createPageActionButtons(tA,list.length>0); const iC=fE.createDiv(); iC.addClass(`items-container-${GLB.displayMode}`); const start=GLB.idxItemStart; const end=Math.min(list.length,start+GLB.nItemPerPage); let nD=0; if(list.length===0)iC.setText(iS?'No starred items.':`No items for filter ('${GLB.filterMode}').`); else if(start>=list.length)iC.setText('No more items.'); else{for(let i=start; i<end; i++){let item:RssFeedItem|null=null; let url:string|null=null; let idx=-1; if(iS){const si=GLB.starredItemsList[i]; item=si.item; url=si.feedUrl; idx=si.originalIndex;}else if(GLB.currentFeed){idx=GLB.displayIndices[i]; item=GLB.feedsStore[GLB.currentFeed]?.items[idx]; url=GLB.currentFeed;} if(!item||!url)continue; // Pass app to createCardItem and createListItem
            if(GLB.displayMode==='card')createCardItem(app, iC,item,idx,url,iS); else createListItem(app, iC,item,idx,url,iS); nD++;}} if(nD>=5){const bA=fE.createDiv({cls:'page-actions bottom-page-actions'}); createPageActionButtons(bA,true);} createPagination(fE,list.length); if(!iS)plugin.updateFeedStatsUI(); plugin.frViewInstance?.updateHeaderText(); }
function createPageActionButtons(container:HTMLElement, hasItems:boolean){ if(hasItems){container.createEl('button',{text:'Mark Page Read',cls:'markPageRead page-action-button'}); container.createEl('button',{text:'Mark Page Delete',cls:'markPageDeleted page-action-button'}); if(GLB.currentFeed!==GLB.STARRED_VIEW_ID)container.createEl('button',{text:'Remove Content',cls:'removePageContent page-action-button'}); container.style.display='flex';}else container.hide(); }
function createPagination(container:HTMLElement, totalItems:number){ const pC=container.createDiv({cls:'pagination-container'}); let hP=false,hN=false; const tP=totalItems>0?Math.ceil(totalItems/GLB.nItemPerPage):0; if(GLB.nPage>1){const p=pC.createEl('button',{text:"◀ Prev",cls:"prevPage pagination-button"}); p.id="prevPage"; hP=true;} if(GLB.idxItemStart+GLB.nItemPerPage<totalItems){const n=pC.createEl('button',{text:"Next ▶",cls:"nextPage pagination-button"}); n.id="nextPage"; hN=true;} if(tP>0){const pi=pC.createSpan({cls:'page-info'}); pi.setText(`Page ${GLB.nPage} of ${tP} (${totalItems} items)`);} else if(totalItems===0&&!hP&&!hN)pC.hide(); }
// Modified: Accept app argument and check app.plugins
function createCardItem(app: App, container:HTMLElement, item:RssFeedItem, idx:number, url:string, isS:boolean){
    const c=container.createDiv({cls:'card-item'});
    c.setAttrs({'data-idx':idx.toString(),'data-feedurl':url,'data-link':item.link||''});
    const th=c.createDiv({cls:'card-thumbnail'});
    const imgUrl=item.imageUrl||GLB.feedsStore[url]?.image;
    const placeholderText = item.title?.substring(0,1)||'?'; // Cache placeholder text

    if(imgUrl){
        const img=th.createEl('img');
        img.src=imgUrl;
        img.alt='Thumbnail'; // Use more descriptive alt text if possible
        img.loading = 'lazy'; // Add lazy loading
        img.onerror=()=>{
            const thumbDiv = img.parentElement;
            if (thumbDiv) {
                img.remove();
                thumbDiv.addClass('no-thumbnail');
                thumbDiv.setText(placeholderText);
            }
        };
    } else {
        th.addClass('no-thumbnail');
        th.setText(placeholderText);
    }
    const cc=c.createDiv({cls:'card-content'});
    const tE=cc.createEl('h3',{cls:'card-title'});
    tE.createEl('a',{href:item.link||'#', text:item.title||'No Title', attr: { target: '_blank', rel: 'noopener noreferrer' }});
    const mI=cc.createDiv({cls:'card-meta'});
    const fN=GLB.feedsStore[url]?.name||url;
    if(isS)mI.createSpan({cls:'card-feed-name',text:fN});
    const dt=item.pubDate||item.downloaded||'';
    if(dt)mI.createSpan({cls:'card-date',text:formatDate(dt)});
    const acts=cc.createDiv({cls:'card-actions'});
    acts.id=`actionContainer${idx}`;
    createActionButtons(acts,item,idx,url,'card');
    if(item.read)c.addClass('read');
    // Apply deleted class correctly
    if(item.deleted) c.addClass('deleted'); else c.removeClass('deleted');
    if(item.starred)c.addClass('starred-item');

    // Apply visibility filter initially
    let plugin: FeedsReader | null = null;
    if (app && app.plugins && typeof app.plugins.getPlugin === 'function') {
        plugin = app.plugins.getPlugin('feeds-reader') as FeedsReader | null;
    }
    if(plugin) plugin.updateItemVisibility(item, idx, url);
}

// Modified: Accept app argument and check app.plugins
function createListItem(app: App, container:HTMLElement, item:RssFeedItem, idx:number, url:string, isS:boolean){
    const iE=container.createDiv({cls:'list-item'});
    iE.setAttrs({'data-idx':idx.toString(),'data-feedurl':url,'data-link':item.link||''});
    const h=iE.createDiv({cls:'list-item-header'});
    const s=h.createEl('span',{text:item.starred?'★':'☆',cls:'item-action-star list-item-star'});
    s.setAttrs({'data-idx':idx.toString(),'data-feedurl':url});
    if(item.starred)s.addClass('starred');
    const tC=h.createDiv({cls:'list-item-title-container'});
    const t=tC.createEl('div',{cls:'list-item-title'});
    t.createEl('a',{href:item.link||'#',text:item.title||'No Title', attr: { target: '_blank', rel: 'noopener noreferrer' }});
    const m=h.createDiv({cls:'list-item-meta'});
    const fN=GLB.feedsStore[url]?.name||url;
    if(isS)m.createSpan({cls:'item-feed-name',text:`(${fN})`});
    if(item.creator)m.createSpan({cls:'item-creator',text:item.creator});
    const dt=item.pubDate||item.downloaded||'';
    if(dt)m.createSpan({cls:'item-date',text:formatDate(dt)});
    const a=iE.createDiv({cls:'list-item-actions'});
    a.id=`actionContainer${idx}`;
    createActionButtons(a,item,idx,url,'list');
    const cC=iE.createDiv({cls:'item-content-container'});
    cC.id=`itemContentContainer_${url}_${idx}`;
    cC.hide();
    if(item.read)iE.addClass('read');
    // Apply deleted class correctly
    if(item.deleted) iE.addClass('deleted'); else iE.removeClass('deleted');
    if(item.starred)iE.addClass('starred-item');

    // Apply visibility filter initially
     let plugin: FeedsReader | null = null;
     if (app && app.plugins && typeof app.plugins.getPlugin === 'function') {
        plugin = app.plugins.getPlugin('feeds-reader') as FeedsReader | null;
    }
    if(plugin) plugin.updateItemVisibility(item, idx, url);
}
function createActionButtons(container: HTMLElement, item: RssFeedItem, idx: number, feedUrl: string, viewType: 'list' | 'card') {
    const s = GLB.settings;
    const star=container.createEl('button',{text:item.starred?'★':'☆',cls:`item-action-button item-action-star ${viewType}-item-star`});
    star.setAttrs({'data-idx':idx.toString(),'data-feedurl':feedUrl});
    if(item.starred)star.addClass('starred');

    if(s.showRead){const b=container.createEl('button',{text:item.read?'Unread':'Read',cls:'item-action-button toggleRead'});b.id=`toggleRead${idx}`;}
    if(s.showDelete){const b=container.createEl('button',{text:item.deleted?'Undelete':'Delete',cls:'item-action-button toggleDelete'});b.id=`toggleDelete${idx}`;}
    if(s.showJot){const b=container.createEl('button',{text:'Jot',cls:'item-action-button jotNotes'});b.id=`jotNotes${idx}`;}
    if(s.showSnippet){const b=container.createEl('button',{text:'Snippet',cls:'item-action-button saveSnippet'});b.id=`saveSnippet${idx}`;}
    if(s.showSave){const b=container.createEl('button',{text:'Save Note',cls:'item-action-button noteThis'});b.id=`noteThis${idx}`;}
    if(s.showMath){const b=container.createEl('button',{text:'Math',cls:'item-action-button renderMath'});b.id=`renderMath${idx}`;}
    if(s.showGPT&&s.chatGPTAPIKey&&s.chatGPTPrompt){const b=container.createEl('button',{text:'GPT',cls:'item-action-button askChatGPT'});b.id=`askChatGPT${idx}`;}
    if(s.showEmbed){container.createEl('button',{text:'Embed',cls:'item-action-button elEmbedButton'});}
    if(s.showFetch){container.createEl('button',{text:'Fetch',cls:'item-action-button elFetch'});}
    if(s.showLink&&item.link){container.createEl('a',{text:'Link',href:item.link,cls:'item-action-link',attr:{target:'_blank', rel:'noopener noreferrer'}});}
}


// --- Utility & Formatting ---
function formatDate(dateString:string):string{if(!dateString)return'';try{const d=new Date(dateString); if(isNaN(d.getTime()))return dateString; const n=new Date(); const s=Math.floor((n.getTime()-d.getTime())/1000); const dy=Math.floor(s/(60*60*24)); if(s<0)return d.toLocaleDateString(); if(s<60)return"just now"; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; if(dy===1)return"Yesterday"; if(dy<7)return`${dy}d ago`; return d.toLocaleDateString();}catch(e){return dateString;}}
function str2filename(s:string):string{if(!s)return'untitled'; const ill=/[\/\?<>\\:\*\|"]/g; const ctrl=/[\x00-\x1f\x80-\x9f]/g; const res=/^\.+$/; const winR=/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i; const winT=/[\. ]+$/; const r='_'; return s.replace(ill,r).replace(ctrl,r).replace(res,r).replace(winR,r).replace(winT,r).replace(/[\[\]]/g,'').replace(/[#^;]/g,'').replace(/\s+/g,'_').substring(0,100);}
function unEscape(htmlStr:string):string{if(!htmlStr)return''; return htmlStr.replace(/</g,"<").replace(/>/g,">").replace(/"/g,"\"").replace(/�*39;/g,"'").replace(/'/g,"'").replace(/&/g,"&").replace(/ /g," ");}
function remedyLatex(s:string):string{if(!s)return''; return s.replace(/\$(\\[a-zA-Z]+)\$([0-9+\-.]+)/g,'\${\$1}$2\$').replace(/\\micron/g,'\\mu{}m').replace(/\\Msun/g,'M_\\odot').replace(/\\Mstar/g,'M_\\ast').replace(/_\*/g,'_\\ast').replace(/_{\*}/g,'_{\\ast}').replace(/(?<!\\)\*/g,'\\*');}

// --- Markdown/HTML Helpers ---
function handle_img_tag(s:string):string{if(!s)return''; return s.replace(/<img src="\/\//g,"<img src=\"https://").replace(/<img\s+[^>]*src="([^"]+)"[^>]*>/gi,"\n![]($1)\n");}
function handle_a_tag(s:string):string{if(!s)return''; return s.replace(/<a\s+[^>]*href="\/\//g,"<a href=\"https://").replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi,"[$2]($1)");}
function handle_tags(s:string):string{if(!s)return''; return s.replace(/<\/?(p|div|span|br)\/?>/gi,' ');}

// --- Statistics ---
function getFeedStats(feedUrl:string):{total:number;read:number;deleted:number;unread:number;starred:number}{let t=0,r=0,d=0,u=0,s=0; const f=GLB.feedsStore[feedUrl]; if(f?.items){t=f.items.length; for(const i of f.items){if(!i)continue; if(i.read)r++; if(i.deleted)d++; if(!i.read&&!i.deleted)u++; if(i.starred)s++;}} return{total:t,read:r,deleted:d,unread:u,starred:s};}
function getFeedStorageInfo(feedUrl:string):[string,string,number,number]{const f=GLB.feedsStore[feedUrl]; if(!f?.items||f.items.length===0)return['0','0B',0,0]; try{const s=JSON.stringify(f); const l=s.length; const z=new Blob([s]).size; const a=f.items.length === 0 ? 0 : Math.floor(l/f.items.length); const zs=getStoreSizeStr(z); return[a.toString(),zs,l,z];}catch(e){return['Err','Err',0,0];}}
function getStoreSizeStr(sz:number):string{if(sz<=0)return'0B'; const i=Math.floor(Math.log(sz)/Math.log(1024)); return`${(sz/Math.pow(1024,i)).toFixed(i===0?0:1)}${['B','KB','MB','GB','TB'][i]}`;}

// --- Feed Management Actions ---
function markAllRead(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items)return; const now=nowdatetime(); let c=false; f.items.forEach(i=>{if(i&&!i.read){i.read=now; i.deleted=null; c=true;}}); if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function purgeDeleted(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items)return; const l=f.items.length; f.items=f.items.filter(i=>i&&!i.deleted); if(f.items.length!==l){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function removeContent(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items)return; let c=false; f.items.forEach(i=>{if(i){if(i.hasOwnProperty('content')){delete (i as Partial<RssFeedItem>).content;c=true;} if(i.hasOwnProperty('creator')){delete (i as Partial<RssFeedItem>).creator;c=true;}}}); if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function removeEmptyFields(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items)return; let c=false; f.items.forEach(i=>{if(i){for(const k in i){if((i as any)[k]===''){delete (i as any)[k];c=true;}} }}); if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function removeContentOld(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items||f.items.length<2)return; let d=Math.floor(f.items.length/3); d=Math.min(d,200); let c=false; for(let i=d; i<f.items.length; i++){const t=f.items[i]; if(t){if(t.hasOwnProperty('content')){delete (t as Partial<RssFeedItem>).content;c=true;} if(t.hasOwnProperty('creator')){delete (t as Partial<RssFeedItem>).creator;c=true;}}} if(c){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function purgeAll(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(f?.items?.length>0){f.items=[]; GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}}
function purgeOldHalf(feedUrl:string){const f=GLB.feedsStore[feedUrl]; if(!f?.items||f.items.length<2)return; const d=Math.floor(f.items.length/2); f.items.splice(d); GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);}
function deduplicate(feedUrl:string):number{const f=GLB.feedsStore[feedUrl]; if(!f?.items||f.items.length<2)return 0; const nB=f.items.length; const seen=new Set<string>(); f.items=f.items.filter(i=>{if(!i?.link||seen.has(i.link))return false; seen.add(i.link); return true;}); const nA=f.items.length; if(nB>nA){GLB.feedsStoreChange=true; GLB.feedsStoreChangeList.add(feedUrl);} return nB-nA;}
// Modified: Accept app for saveSubscriptions
async function removeFeed(app: App, adapter: DataAdapter, feedUrl: string, plugin: FeedsReader) {
    const idx = GLB.feedList.findIndex(f => f.feedUrl === feedUrl);
    if (idx === -1) return;
    const name = GLB.feedList[idx].name;
    GLB.feedList.splice(idx, 1);
    if (GLB.feedsStore[feedUrl]) delete GLB.feedsStore[feedUrl];
    // Pass app to saveSubscriptions
    await saveSubscriptions(app, adapter);
    const folder = `${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`;
    if (await adapter.exists(folder)) {
        for (let i = 0; ; i++) {
            const fn = makeFilename(name, i);
            const gz = `${folder}/${fn}.gzip`;
            const pl = `${folder}/${fn}`;
            let rm = false;
            try { if (await adapter.exists(gz)) { await adapter.remove(gz); rm = true; } } catch (e) { console.warn(`Cannot rm ${gz}`, e); }
            try { if (await adapter.exists(pl)) { await adapter.remove(pl); rm = true; } } catch (e) { console.warn(`Cannot rm ${pl}`, e); }
            if (!rm) break;
            new Notice(`Removed stored data chunk for ${name}...`, 1000);
        }
    }
    await plugin.createFeedBar();
    if (GLB.currentFeed === feedUrl) { GLB.currentFeed = null; GLB.currentFeedName = ''; plugin.show_feed(); }
}


// --- File I/O Helpers ---
function makeFilename (fname_base:string, iPostfix:number):string{const s=str2filename(fname_base); return`${s}-${iPostfix.toString()}.json.frag`;}
// Modified: Accept app for potential folder creation in fallback
async function saveStringToFileGzip(app: App, adapter: DataAdapter, s:string, folder:string, fname:string): Promise<boolean>{
    let w = false;
    const p = `${folder}/${fname}.gzip`;
    try {
        // Folder creation is expected to happen *before* calling this,
        // but keep the check in fallback for robustness.
        // if(!await adapter.exists(folder))await app.vault.createFolder(folder); // Use vault
        const d = await compress(s);
        await adapter.writeBinary(p, d.buffer);
        w = true;
        const pl = `${folder}/${fname}`;
        if (await adapter.exists(pl)) await adapter.remove(pl);
    } catch (e) {
        console.error(`Gzip Save ${fname} Err:`, e);
        // Pass app to fallback saveStringToFile
        w = await saveStringToFile(app, adapter, s, folder, fname);
    }
    return w;
}
// Modified: Accept app for potential folder creation
async function saveStringToFile(app: App, adapter: DataAdapter, s:string, folder:string, fname:string): Promise<boolean>{
    let w = false;
    const p = `${folder}/${fname}`;
    try {
        // Ensure folder exists using vault API
        if (!await adapter.exists(folder)) await app.vault.createFolder(folder);
        const ex = await adapter.exists(p);
        let cur = ex ? await adapter.read(p) : null;
        if (cur !== s) { await adapter.write(p, s); w = true; }
    } catch (e: any) {
        console.error(`Plain Save ${fname} Err:`, e);
        w = false;
    }
    return w;
}
// Modified: Accept app to pass down to saveStringToFileGzip
async function saveStringSplitted(app: App, adapter: DataAdapter, s:string, folder:string, fname_base:string, nCharPerFile:number): Promise<number>{
    const l = s.length;
    let nS = 0;
    const p: Promise<boolean>[] = [];
    const rF = new Set<string>();
    for (let i = 0; ; i++) {
        const iS = i * nCharPerFile;
        if (iS >= l) break;
        const iE = Math.min((i + 1) * nCharPerFile, l);
        const c = s.substring(iS, iE);
        const fn = makeFilename(fname_base, i);
        rF.add(fn);
        // Pass app down
        p.push(saveStringToFileGzip(app, adapter, c, folder, fn));
    }
    const res = await Promise.allSettled(p);
    res.forEach(r => { if (r.status === 'fulfilled' && r.value === true) nS++; else if (r.status === 'rejected') console.error("Chunk save err:", r.reason); });
    try {
        if (await adapter.exists(folder)) {
            const { files } = await adapter.list(folder);
            const bP = makeFilename(fname_base, 0).split('-0.')[0];
            for (const fp of files) {
                const fnWE = fp.split('/').pop();
                if (!fnWE) continue;
                const isGz = fnWE.endsWith('.gzip');
                const fn = isGz ? fnWE.slice(0, -5) : fnWE;
                if (fn.startsWith(bP) && fn.endsWith('.json.frag') && !rF.has(fn)) {
                    console.log(`Rm obsolete chunk: ${fp}`);
                    try { await adapter.remove(fp); } catch (rmErr) { console.warn(`Cannot rm ${fp}`, rmErr); }
                }
            }
        }
    } catch (e) { console.error("Obsolete chunk rm err:", e); }
    return nS;
}
async function loadStringSplitted_Gzip(adapter: DataAdapter, folder:string, fname_base:string): Promise<string>{let c:string[]=[]; try{if(await adapter.exists(folder)){for(let i=0;;i++){const fn=makeFilename(fname_base,i); const p=`${folder}/${fn}.gzip`; if(!await adapter.exists(p))break; try{c[i]=await decompress(await adapter.readBinary(p));}catch(e:any){console.error(`Gzip Load ${fn} Err:`,e); break;}}}}catch(e){console.error(`Gzip Dir ${fname_base} Err:`,e);} return c.join('');}
async function loadStringSplitted(adapter: DataAdapter, folder:string, fname_base:string): Promise<string>{let c:string[]=[]; try{if(await adapter.exists(folder)){for(let i=0;;i++){const fn=makeFilename(fname_base,i); const p=`${folder}/${fn}`; if(!await adapter.exists(p))break; try{c[i]=await adapter.read(p);}catch(e:any){console.error(`Plain Load ${fn} Err:`,e); break;}}}}catch(e){console.error(`Plain Dir ${fname_base} Err:`,e);} return c.join('');}

// --- External APIs ---
async function fetchChatGPT(apiKey:string, temperature:number, text:string): Promise<string>{try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-3.5-turbo',temperature,messages:[{role:"user",content:text}]})}); if(!r.ok){const ed=await r.json().catch(()=>({})); throw new Error(`GPT API Err: ${r.status} ${r.statusText}. ${ed?.error?.message||''}`);} const d=await r.json(); const m=d?.choices?.[0]?.message?.content; if(!m){console.error("Invalid GPT response:",d); throw new Error("Invalid response from GPT.");} return m;}catch(e:any){console.error("GPT fetch error:",e); throw e;}}

// --- Modal Window Class Definitions ---
class ItemContentModal extends Modal { item: RssFeedItem; feedName: string; plugin: Component; constructor(app: App, item: RssFeedItem, feedName: string, plugin: Component) { super(app); this.item = item; this.feedName = feedName; this.plugin = plugin; } onOpen() { const { contentEl, titleEl } = this; contentEl.addClass('feed-item-modal-content'); titleEl.setText(this.item.title || 'Item Detail'); const headerInfo = contentEl.createDiv({ cls: 'modal-header-info' }); headerInfo.createSpan({ cls: 'modal-feed-name', text: `Feed: ${this.feedName}` }); headerInfo.createSpan({ cls: 'modal-item-date', text: `Date: ${formatDate(this.item.pubDate || this.item.downloaded)}` }); // Corrected: Moved target into attr
        if (this.item.link) headerInfo.createEl('a', { href: this.item.link, text: 'Open Original', cls: 'modal-original-link', attr: { target: '_blank', rel: 'noopener noreferrer' }}); if (this.item.creator) headerInfo.createSpan({cls: 'modal-item-author', text: `Author: ${this.item.creator}`}); contentEl.createEl('hr'); const bodyDiv = contentEl.createDiv({ cls: 'modal-content-body' }); if (this.item.content) { try { const s = this.item.content.replace(/ src="\/\//g, ' src="https://'); const m = htmlToMarkdown(s); const p = remedyLatex(m); MarkdownRenderer.render(this.app, p, bodyDiv, this.item.link || this.feedName, this.plugin); } catch (e) { console.error("Render modal err:", e); try { const f = sanitizeHTMLToDom(this.item.content.replace(/ src="\/\//g, ' src="https://')); bodyDiv.empty(); bodyDiv.appendChild(f); } catch (se) { console.error("Sanitize modal err:", se); bodyDiv.empty(); bodyDiv.setText('Failed display content.'); } } } else bodyDiv.setText('No content available.'); } onClose() { this.contentEl.empty(); } }
class EmbedModal extends Modal { url: string; itemTitle?: string; constructor(app: App, url: string, itemTitle?: string){ super(app); this.url = url; this.itemTitle = itemTitle; } onOpen(){ this.titleEl.setText(this.itemTitle || "Embed"); this.contentEl.addClass('feed-embed-modal'); const iframe = this.contentEl.createEl('iframe'); iframe.src = this.url; iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms'); iframe.addClass('embedded-modal-iframe'); } onClose(){ this.contentEl.empty(); } }
class FetchContentModal extends Modal { url: string; itemTitle?: string; constructor(app: App, url: string, itemTitle?: string){ super(app); this.url = url; this.itemTitle = itemTitle; } async onOpen(){ this.titleEl.setText(this.itemTitle || "Fetched Content"); this.contentEl.addClass('feed-fetch-modal'); const load = this.contentEl.createEl('p',{text:`Fetching ${this.url}...`}); try{ const src=await request({url:this.url,method:"GET"}); load.remove(); const cont=this.contentEl.createDiv({cls:'fetch-modal-container'}); const frag=sanitizeHTMLToDom(src); cont.appendChild(frag); } catch(e:any){ load.setText(`Fetch Failed: ${e.message}`); console.error("Fetch content err:",e); } } onClose(){ this.contentEl.empty(); } }
class MathRenderModal extends Modal { item: RssFeedItem; plugin: Component; constructor(app: App, item: RssFeedItem, plugin: Component) { super(app); this.item = item; this.plugin = plugin; } onOpen() { const { contentEl, titleEl } = this; titleEl.setText(`Math Preview: ${this.item.title||''}`); contentEl.addClass('feed-math-modal'); if(this.item.content){ try{ const m=remedyLatex(htmlToMarkdown(this.item.content)); MarkdownRenderer.render(this.app,m,contentEl,this.item.link||'',this.plugin); } catch(e){contentEl.setText("Error rendering math content."); console.error("Math render err:",e);} } else contentEl.setText("No content to render."); } onClose(){ this.contentEl.empty(); } }
class ChatGPTInteractionModal extends Modal { item:RssFeedItem; apiKey:string; promptText:string; textArea:HTMLTextAreaElement; responseArea:HTMLElement; plugin:Component; constructor(app:App, item:RssFeedItem, apiKey:string, promptText:string, plugin:Component){ super(app); this.item=item; this.apiKey=apiKey; this.promptText=promptText; this.plugin=plugin; } async onOpen(){ const {contentEl,titleEl}=this; titleEl.setText(`Ask GPT: ${this.item.title||''}`); contentEl.addClass('feed-gpt-modal'); contentEl.createEl('h4',{text:'Content Snippet:'}); const snip=(htmlToMarkdown(this.item.content||'')||'').substring(0,300); contentEl.createEl('p',{text:snip+(snip.length===300?'...':'')}); contentEl.createEl('h4',{text:'Your Prompt:'}); this.textArea=contentEl.createEl('textarea'); this.textArea.rows=4; this.textArea.value=this.promptText; const btnCont=contentEl.createDiv({cls:'gpt-button-container'}); const subBtn=btnCont.createEl('button',{text:'Send to GPT'}); const loadInd=btnCont.createSpan({cls:'gpt-loading',text:' Sending...'}); loadInd.style.display='none'; contentEl.createEl('h4',{text:'GPT Response:'}); this.responseArea=contentEl.createDiv({cls:'gpt-response-area'}); this.responseArea.setText('Awaiting prompt submission...'); subBtn.onclick=async ()=>{ const uP=this.textArea.value.trim(); if(!uP){new Notice("Prompt cannot be empty."); return;} const fullP=`${uP}\n\n---\n\n${htmlToMarkdown(this.item.content||'')}`; subBtn.disabled=true; loadInd.style.display='inline-block'; this.responseArea.setText('Waiting for response from OpenAI...'); try{ const reply=await fetchChatGPT(this.apiKey,0.5,fullP); this.responseArea.empty(); MarkdownRenderer.render(this.app,reply,this.responseArea,'',this.plugin); } catch(e:any){this.responseArea.setText(`Error: ${e.message||'Failed to get response.'}`); console.error("GPT interaction err:",e);} finally{ subBtn.disabled=false; loadInd.style.display='none'; }}; } onClose(){ this.contentEl.empty(); } }
class AddFeedModal extends Modal { plugin: FeedsReader; constructor(app: App, plugin: FeedsReader) { super(app); this.plugin = plugin; } onOpen() { const {contentEl}=this; this.titleEl.innerText="Add New Feed"; const f=contentEl.createEl('form'); const t=f.createEl('table',{cls:'addFeedTable'}); const b=t.createTBody(); let r=b.createEl('tr'); r.createEl('td',{text:"Name"}); const nI=r.createEl('td').createEl('input',{attr:{required:true}}); nI.id='newFeedName'; nI.type='text'; nI.placeholder = 'e.g., My Favorite Blog'; r=b.createEl('tr'); r.createEl('td',{text:"URL"}); const uI=r.createEl('td').createEl('input',{attr:{required:true}}); uI.id='newFeedUrl'; uI.type='url'; uI.placeholder = 'https://example.com/feed'; r=b.createEl('tr'); r.createEl('td',{text:"Folder (Optional)"}); const fI=r.createEl('td').createEl('input'); fI.id='newFeedFolder'; fI.type='text'; fI.placeholder = 'e.g., News'; r=b.createEl('tr'); r.createEl('td'); const btnTd=r.createEl('td'); const saveBtn=btnTd.createEl('button',{text:"Add Feed"}); saveBtn.type='submit'; f.onsubmit=async(e)=>{ e.preventDefault(); const name=nI.value.trim(); const url=uI.value.trim(); const folder=fI.value.trim(); if(!name||!url){new Notice("Feed Name and URL are required.",2000); return;} try{new URL(url);}catch(_){new Notice("The entered URL is invalid.",2000); return;} if(GLB.feedList.some(f=>f.feedUrl===url)){new Notice("This feed URL already exists.",2000); return;} if(GLB.feedList.some(f=>f.name===name)){new Notice("This feed name is already used.",2000); return;} GLB.feedList.push({name,feedUrl:url,folder,unread:0,updated:0}); sort_feed_list(); await this.plugin.saveSubscriptions(); await this.plugin.createFeedBar(); new Notice(`Feed "${name}" added successfully!`,2000); this.close(); }; } onClose(){this.contentEl.empty();} }
// Modified: Store app instance in constructor
class SearchModal extends Modal {
    app: App; // Store app instance

    constructor(app: App){
        super(app);
        this.app = app; // Assign app to instance variable
    }

    onOpen(){
        const {contentEl} = this;
        this.titleEl.innerText="Search Current Feed";
        const f=contentEl.createEl('form');
        const t=f.createEl('table',{cls:'searchForm'});
        const b=t.createTBody();
        let r=b.createEl('tr');
        r.createEl('td',{text:'Search Terms'});
        const i=r.createEl('td').createEl('input',{cls:'searchTerms'});
        i.id='searchTerms'; i.type='search'; i.placeholder='Enter keywords...';
        r=b.createEl('tr');
        r.createEl('td',{text:"Whole Word Only"});
        const c=r.createEl('td').createEl('input',{attr:{type:'checkbox'}});
        c.id='checkBoxWordwise';
        r=b.createEl('tr');
        r.createEl('td');
        const sB=r.createEl('td').createEl('button',{text:"Search"});
        sB.type='submit';

        // Use arrow function to maintain 'this' context
        f.onsubmit = (e) => {
            e.preventDefault();
            const wW=c.checked;
            const tms=([...new Set(i.value.toLowerCase().split(/[ ,;\t\n]+/).filter(term=>term))].sort((a,b)=>b.length-a.length));
            if(tms.length===0){ new Notice("Please enter search terms."); return; }
            if(!GLB.currentFeed||GLB.currentFeed===GLB.STARRED_VIEW_ID){ new Notice("Search not available for this view."); return; }
            const its=GLB.feedsStore[GLB.currentFeed]?.items;
            if(!its){ new Notice("Feed data not loaded."); return; }
            const sep=/\s+/;
            GLB.displayIndices=[];
            for(let itemIndex=0; itemIndex<its.length; itemIndex++){
                let it=its[itemIndex];
                if(!it)continue;
                let hS:string|string[];
                const ti=it.title?.toLowerCase()||'';
                const cr=it.creator?.toLowerCase()||'';
                const co=it.content ? htmlToMarkdown(it.content).toLowerCase() : ''; // Search markdown content

                if(wW){hS=[...ti.split(sep), ...cr.split(sep), ...co.split(sep)].filter(s => s);} // Combine and filter empty strings
                else {hS=`${ti} ${cr} ${co}`;}

                let found=tms.every(tm => {
                    if (wW && Array.isArray(hS)) {
                        return hS.includes(tm);
                    } else if (!wW && typeof hS === 'string') {
                        return hS.includes(tm);
                    }
                    return false;
                });
                if(found)GLB.displayIndices.push(itemIndex);
            }
            GLB.idxItemStart=0; GLB.nPage=1; new Notice(`Found ${GLB.displayIndices.length} matching items.`);

            // Use the stored app instance (this.app) and check for plugin availability
            let pluginInstance: FeedsReader | null = null;
             if (this.app && this.app.plugins && typeof this.app.plugins.getPlugin === 'function') {
                pluginInstance = this.app.plugins.getPlugin('feeds-reader') as FeedsReader | null;
            }

            if (pluginInstance) {
                pluginInstance.show_feed();
            } else {
                console.error("Could not find FeedsReader plugin instance in SearchModal");
            }
            this.close();
        };
    }
    onClose(){this.contentEl.empty();}
}
class ManageFeedsModal extends Modal { plugin: FeedsReader; asc: boolean = true; constructor(app: App, plugin: FeedsReader) { super(app); this.plugin = plugin; } onOpen() { const {contentEl}=this; this.titleEl.innerText="Manage Feeds"; contentEl.addClass('manageFeedsModal'); contentEl.createDiv({cls:'manage-feeds-warning'}).innerHTML = '<b>CAUTION:</b> Actions take effect immediately. Refresh may be needed.<br>N:Name, U:URL, F:Folder, T:Total, R:Read, D:Deleted, A:Avg Size, S:Storage'; contentEl.createEl('hr'); const actions=contentEl.createDiv({cls:'manage-feeds-actions'}); actions.createEl('button',{text:'Apply N/U/F Changes'}).addEventListener('click',async()=>{ await this.applyNameUrlFolderChanges(); }); actions.createEl('button',{text:'Mark Selected Read'}).addEventListener('click',()=>{ this.runActionOnSelected('Mark all items in selected feeds read?', this.plugin.markAllRead.bind(this.plugin)); }); actions.createEl('button',{text:'Purge Deleted'}).addEventListener('click',()=>{ this.runActionOnSelected('Permanently purge deleted items from selected feeds?', this.plugin.purgeDeleted.bind(this.plugin)); }); actions.createEl('button',{text:'Remove Content'}).addEventListener('click',()=>{ this.runActionOnSelected('Remove ALL downloaded content (title, etc. remain) from selected feeds?', this.plugin.removeContent.bind(this.plugin)); }); actions.createEl('button',{text:'Deduplicate'}).addEventListener('click',()=>{ this.runActionOnSelected('Deduplicate items by link in selected feeds?', this.plugin.deduplicate.bind(this.plugin), true); }); actions.createEl('button',{text:'Remove Selected Feeds'}).addEventListener('click',async()=>{ await this.removeSelectedFeeds(); }); contentEl.createEl('br'); const formContainer=contentEl.createEl('div'); const form=formContainer.createEl('table',{cls:'manageFeedsForm'}); const head=form.createTHead().createEl('tr'); head.createEl('th',{text:"N/U"}); head.createEl('th',{text:"F"}); head.createEl('th',{text:"T"}); head.createEl('th',{text:"R"}); head.createEl('th',{text:"D"}); head.createEl('th',{text:"A"}); head.createEl('th',{text:"S"}); const checkAllTh=head.createEl('th'); const checkAll=checkAllTh.createEl('input',{attr:{type:'checkbox'}}); checkAll.id='checkAll'; checkAll.onchange=()=>{const isChecked=checkAll.checked; contentEl.querySelectorAll<HTMLInputElement>('.checkThis').forEach(el=>el.checked=isChecked);}; const tbody=form.createTBody(); let nT=0,nR=0,nD=0,nL=0,nS=0; GLB.feedList.forEach((item, i)=>{ const tr=tbody.createEl('tr'); const nameCell=tr.createEl('td',{cls:'cellNameContainer'}); const nameInput=nameCell.createEl('input',{value:item.name}); nameInput.id=`manageFdName${i}`; const urlInput=nameCell.createEl('input',{value:item.feedUrl}); urlInput.id=`manageFdUrl${i}`; urlInput.readOnly = true; // Make URL readonly to avoid accidental changes leading to data loss without explicit rename logic
        const folderCell=tr.createEl('td',{cls:'cellFolderContainer'}); const folderInput=folderCell.createEl('input',{value:item.folder || ''}); folderInput.id=`manageFdFolder${i}`; const stats=this.plugin.getFeedStats(item.feedUrl); const storeInfo=this.plugin.getFeedStorageInfo(item.feedUrl); tr.createEl('td',{text:stats.total.toString()}).setAttribute('sortBy',stats.total.toString()); tr.createEl('td',{text:stats.read.toString()}).setAttribute('sortBy',stats.read.toString()); tr.createEl('td',{text:stats.deleted.toString()}).setAttribute('sortBy',stats.deleted.toString()); tr.createEl('td',{text:storeInfo[0]}).setAttribute('sortBy',(storeInfo[2]/(stats.total||1)).toString()); tr.createEl('td',{text:storeInfo[1]}).setAttribute('sortBy',storeInfo[3].toString()); const checkTd=tr.createEl('td'); const check=checkTd.createEl('input',{attr:{type:'checkbox'},cls:'checkThis'}); check.setAttribute('val',item.feedUrl); check.setAttribute('fdName',item.name); nT+=stats.total; nR+=stats.read; nD+=stats.deleted; nL+=storeInfo[2]; nS+=storeInfo[3]; }); const foot=form.createTFoot().createEl('tr'); foot.createEl('td',{text:`Total: ${GLB.feedList.length}`}); foot.createEl('td'); foot.createEl('td',{text:nT.toString()}); foot.createEl('td',{text:nR.toString()}); foot.createEl('td',{text:nD.toString()}); foot.createEl('td',{text:Math.floor(nL/(nT||1)).toString()}); foot.createEl('td',{text:getStoreSizeStr(nS)}); foot.createEl('td'); head.querySelectorAll('th:nth-child(-n+7)').forEach((th,idx)=>{th.addEventListener('click',()=>{const tbody=form.querySelector('tbody'); if(!tbody)return; Array.from(tbody.querySelectorAll('tr:not(:last-child)')).sort(this.comparer(idx,this.asc=!this.asc)).forEach(tr=>tbody.appendChild(tr));});}); } comparer=(idx:number, asc:boolean)=>(a:Element, b:Element)=>{const v1=this.getCellValue(a,idx); const v2=this.getCellValue(b,idx); const n1=parseFloat(v1); const n2=parseFloat(v2); return (v1!==''&&v2!==''&&!isNaN(n1)&&!isNaN(n2))?(asc?n1-n2:n2-n1):(asc?v1.localeCompare(v2):v2.localeCompare(v1));}; getCellValue=(tr:Element, idx:number):string=>{const cell=tr.children[idx]; if(!cell) return ''; const input=cell.querySelector('input'); if(input)return input.value; return cell.getAttribute('sortBy') || cell.textContent || '';}; async applyNameUrlFolderChanges(){ let changed=false; const renameOps:{oldName:string, newName:string, oldUrl: string}[]=[]; // Store oldUrl too
    // const reUrlOps:{oldUrl:string, newUrl:string}[]=[]; // URL change disabled for now
    for(let i=0; i<GLB.feedList.length; i++){ const nameInput=document.getElementById(`manageFdName${i}`) as HTMLInputElement; // const urlInput=document.getElementById(`manageFdUrl${i}`) as HTMLInputElement; // URL input is readonly
        const folderInput=document.getElementById(`manageFdFolder${i}`) as HTMLInputElement; if(!nameInput||!folderInput) continue; const newName=nameInput.value.trim(); // const newUrl=urlInput.value.trim(); // Readonly
        const newFolder=folderInput.value.trim(); const oldItem=GLB.feedList[i]; let nameChanged=oldItem.name!==newName; // let urlChanged=oldItem.feedUrl!==newUrl; // Always false
        let folderChanged=(oldItem.folder||'')!==(newFolder||''); // Compare empty strings properly
        if(nameChanged&&!newName){new Notice(`Name cannot be empty for ${oldItem.name}.`,2000); nameChanged=false;} // if(urlChanged&&!newUrl){new Notice(`URL cannot be empty for ${oldItem.name}.`,2000); urlChanged=false;}
        // if(urlChanged){try{new URL(newUrl);}catch(_){new Notice(`Invalid new URL for ${oldItem.name}.`,2000); urlChanged=false;}}
        if(nameChanged&&GLB.feedList.some((f,j)=>j!==i&&f.name===newName)){new Notice(`Name "${newName}" already used.`,2000); nameChanged=false;} // if(urlChanged&&GLB.feedList.some((f,j)=>j!==i&&f.feedUrl===newUrl)){new Notice(`URL "${newUrl}" already exists.`,2000); urlChanged=false;}
        if(nameChanged||folderChanged){ // Removed urlChanged condition
            changed=true; if(nameChanged)renameOps.push({oldName:oldItem.name, newName, oldUrl: oldItem.feedUrl}); // if(urlChanged)reUrlOps.push({oldUrl:oldItem.feedUrl, newUrl});
            if(folderChanged)oldItem.folder=newFolder; if(nameChanged)oldItem.name=newName; // if(urlChanged)oldItem.feedUrl=newUrl;
        } } if(changed){ try{ // Rename files BEFORE updating GLB.feedList or GLB.feedsStore
        await Promise.all(renameOps.map(op=>this.renameFeedFiles(op.oldName, op.newName))); // Rename based on names first
        // Update names in GLB.feedsStore AFTER file rename
        renameOps.forEach(op => {
            const feedData = GLB.feedsStore[op.oldUrl]; // Find data by URL
            if (feedData) {
                feedData.name = op.newName; // Update the name property within the stored data
                GLB.feedsStoreChange = true; // Mark for saving
                GLB.feedsStoreChangeList.add(op.oldUrl); // Use URL as the key
            }
        });
        // reUrlOps.forEach(op=>{if(GLB.feedsStore[op.oldUrl]){GLB.feedsStore[op.newUrl]=GLB.feedsStore[op.oldUrl]; delete GLB.feedsStore[op.oldUrl];}}); // URL change disabled
        sort_feed_list(); await this.plugin.saveSubscriptions(); // Save updated names/folders in subscriptions
        await this.plugin.saveFeedsData(); // Save updated names within feed data files
        await this.plugin.createFeedBar(); new Notice("Changes applied. Feed list updated.",1500); this.close(); } catch(e:any){ new Notice(`Error applying changes: ${e.message}`, 3000); console.error(e); } } else new Notice("No valid changes detected.",1000); } async renameFeedFiles(oldName:string, newName:string){ const folder=`${GLB.feeds_reader_dir}/${GLB.feeds_store_base}`; const adapter = this.plugin.app.vault.adapter; for(let i=0;;i++){const oldFn=this.plugin.makeFilename(oldName,i); const newFn=this.plugin.makeFilename(newName,i); const oldGz=`${folder}/${oldFn}.gzip`; const oldPl=`${folder}/${oldFn}`; const newGz=`${folder}/${newFn}.gzip`; const newPl=`${folder}/${newFn}`; let foundOld=false; try{if(await adapter.exists(oldGz)){console.log(`Renaming ${oldGz} to ${newGz}`); await adapter.rename(oldGz, newGz); foundOld=true;}}catch(e){console.warn(`Rename failed ${oldGz} -> ${newGz}`,e);} try{if(await adapter.exists(oldPl)){console.log(`Renaming ${oldPl} to ${newPl}`); await adapter.rename(oldPl, newPl); foundOld=true;}}catch(e){console.warn(`Rename failed ${oldPl} -> ${newPl}`,e);} if(!foundOld)break; // Stop if no file with this index exists
    }} runActionOnSelected(confirmMsg:string, actionFn:(feedUrl:string)=>any, noticeResult=false){ const checked=Array.from(document.querySelectorAll<HTMLInputElement>('.checkThis:checked')); if(checked.length===0){new Notice("No feeds selected.",1500); return;} if(!window.confirm(confirmMsg))return; let changed=false; let results:{name:string, result:any}[]=[]; checked.forEach(el=>{const url=el.getAttribute('val'); const name=el.getAttribute('fdName'); if(url){try{const result=actionFn(url); // Call the action function (e.g., markAllRead, purgeDeleted)
                if(result !== undefined && result !== false) { // Check if action returned meaningful result
                    results.push({name: name||url, result});
                } changed=true;}catch(e:any){new Notice(`Error on ${name||url}: ${e.message}`,2000); console.error(e);}}}); if(changed){this.plugin.createFeedBar(); // Refresh feed bar to show updated stats
        new Notice("Action applied to selected feeds.",1500); if(noticeResult && results.length > 0) { // Show results if requested and available
            results.forEach(r=>new Notice(`${r.name}: ${r.result}`));
        } // No need to close automatically, user might want to perform more actions
        // Refresh the table data in the modal itself
        this.onOpen(); // Re-render the modal content
        // this.close();
    } } async removeSelectedFeeds(){ const checked=Array.from(document.querySelectorAll<HTMLInputElement>('.checkThis:checked')); if(checked.length===0){new Notice("No feeds selected.",1500); return;} if(!window.confirm(`Remove ${checked.length} feed(s) and ALL associated data? This CANNOT BE UNDONE.`))return; await Promise.all(checked.map(el=>this.plugin.removeFeed(el.getAttribute('val')||''))); new Notice(`${checked.length} feed(s) removed.`,2000); // Refresh the modal content after removal
    this.onOpen(); // Re-render the modal content
    // this.close();
    } async onClose() { this.contentEl.empty(); if (GLB.feedsStoreChange) { // Refresh feed bar if data changed
        await this.plugin.createFeedBar();
        // Optionally refresh the main view if the current feed was affected
        if (GLB.currentFeed && GLB.feedsStoreChangeList.has(GLB.currentFeed)) {
            this.plugin.makeDisplayList();
            this.plugin.show_feed();
        }
    } } }

// --- Setting Tab ---
class FeedReaderSettingTab extends PluginSettingTab {
	plugin: FeedsReader;
	constructor(app: App, plugin: FeedsReader) { super(app, plugin); this.plugin = plugin; }
	display(): void {
        const { containerEl } = this; containerEl.empty(); containerEl.createEl('h2', { text: 'Settings for Feeds Reader' });
        containerEl.createEl('h3', { text: 'ChatGPT (Optional)' });
        new Setting(containerEl).setName('API Key').setDesc('Your OpenAI API Key').addText(t=>t.setPlaceholder('sk-...').setValue(this.plugin.settings.chatGPTAPIKey||'').onChange(async(v)=>{this.plugin.settings.chatGPTAPIKey=v; GLB.settings.chatGPTAPIKey=v; await this.plugin.saveSettings();}));
        new Setting(containerEl).setName('Default Prompt').setDesc('The default instruction for ChatGPT interactions.').addTextArea(t=>t.setPlaceholder(DEFAULT_SETTINGS.chatGPTPrompt||'').setValue(this.plugin.settings.chatGPTPrompt||'').onChange(async(v)=>{this.plugin.settings.chatGPTPrompt=v; GLB.settings.chatGPTPrompt=v; await this.plugin.saveSettings();}));
        containerEl.createEl('h3', { text: 'Appearance' });
        new Setting(containerEl).setName('Default Display Mode').setDesc('Choose how feed items are initially displayed.').addDropdown(d=>d.addOption('card','Card View').addOption('list','List View').setValue(this.plugin.settings.defaultDisplayMode).onChange(async(v:'card'|'list')=>{this.plugin.settings.defaultDisplayMode=v;GLB.displayMode=v;await this.plugin.saveSettings(); this.plugin.show_feed(); /* Refresh view */}));
        new Setting(containerEl).setName('Card Width (pixels)').setDesc('Set the width for items in Card View (min 180, max 800).').addText(t=>t.setPlaceholder('280').setValue(this.plugin.settings.cardWidth.toString()).onChange(async(v)=>{let w=parseInt(v); if(isNaN(w)) w=280; w = Math.max(180, Math.min(800, w)); /* Apply bounds */ this.plugin.settings.cardWidth=w; GLB.cardWidth=w; document.documentElement.style.setProperty('--card-item-width',`${w}px`); await this.plugin.saveSettings();}));
        new Setting(containerEl).setName('Items Per Page').setDesc('Number of feed items to show on each page.').addText(t=>t.setPlaceholder('20').setValue(this.plugin.settings.nItemPerPage.toString()).onChange(async(v)=>{const n=parseInt(v)||20; this.plugin.settings.nItemPerPage=n>0?n:20; GLB.nItemPerPage=this.plugin.settings.nItemPerPage; await this.plugin.saveSettings(); if(GLB.currentFeed)this.plugin.show_feed(); /* Refresh view */}));
        containerEl.createEl('h4', { text: 'Show Action Buttons' });
        const toggles:{k:keyof FeedsReaderSettings; n:string; d: string}[]=[ {k:'showRead',n:'Read/Unread', d:'Mark items as read or unread.'}, {k:'showDelete',n:'Delete/Undelete', d:'Mark items as deleted or restore them.'}, {k:'showJot',n:'Jot Notes', d:'Quickly jot down temporary notes associated with an item.'}, {k:'showSnippet',n:'Save Snippet', d:'Save item title, link, and optional content/notes to a snippets file.'}, {k:'showSave',n:'Save as Note', d:'Create a new Obsidian note from the feed item.'}, {k:'showMath',n:'Render Math', d:'Attempt to render LaTeX math in item content (requires MathJax).'}, {k:'showGPT',n:'Ask GPT', d:'Send item content to ChatGPT (requires API key).'}, {k:'showEmbed',n:'Embed Link', d:'Open the item link in an embedded iframe modal.'}, {k:'showFetch',n:'Fetch Full Page', d:'Attempt to fetch and display the full content of the linked page.'}, {k:'showLink',n:'Open Link', d:'Show a direct link to open the original item URL.'}, ];
        toggles.forEach(s=>{ new Setting(containerEl).setName(s.n).setDesc(s.d).addToggle(t=>t.setValue(this.plugin.settings[s.k] as boolean).onChange(async(v)=>{(this.plugin.settings[s.k] as boolean)=v; (GLB.settings[s.k] as boolean)=v; await this.plugin.saveSettings(); if(GLB.currentFeed)this.plugin.show_feed(); /* Refresh view */ })); });
        containerEl.createEl('h3', { text: 'Saving Behavior' });
        new Setting(containerEl).setName('Save Content in Notes/Snippets').setDesc('If enabled, includes the item\'s content when saving snippets or creating notes.').addToggle(t=>t.setValue(this.plugin.settings.saveContent).onChange(async(v)=>{this.plugin.settings.saveContent=v; GLB.settings.saveContent=v; await this.plugin.saveSettings();}));
        new Setting(containerEl).setName('Prepend New Snippets').setDesc('ON: Add new snippets to the top of the snippets file. OFF: Append to the bottom.').addToggle(t=>t.setValue(this.plugin.settings.saveSnippetNewToOld).onChange(async(v)=>{this.plugin.settings.saveSnippetNewToOld=v; GLB.settings.saveSnippetNewToOld=v; await this.plugin.saveSettings();}));
    }
}