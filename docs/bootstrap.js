// Report module-download failures even when the main game's imports cannot run.
import('./exact-viewer.js?v=pages-performance-2').catch(error=>{
 const message='Unable to load the game: '+error.message+'. Refresh to retry.';
 const status=document.querySelector('#menu-message');status.textContent=message;status.dataset.error='true';
 document.querySelector('#scene').dataset.loadState='error';console.error(error);
});
