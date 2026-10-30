/*
Last Modified time : 20220211 15:38 by https://immmmm.com
已适配 FriendCircle 公共库和主库
*/
var fdatalist = JSON.parse(localStorage.getItem("fdatalist")) || {};

function parseArticleData(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  try {
    var parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('友链朋友圈文章数据格式无效', error);
    return [];
  }
}

function escapeFcircleHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeFcircleUrl(value) {
  try {
    var parsed = new URL(String(value), window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
  } catch (error) {
    return '#';
  }
}
//默认数据
var fcdata = {
  jsonurl: '',
  apiurl: '',
  apipublicurl: fdatalist.apiurl, //默认公共库
  initnumber: fdatalist.initnumber,  //首次加载文章数
  stepnumber: fdatalist.stepnumber,  //更多加载文章数
  article_sort: 'created', //文章排序 updated or created
  error_img: 'https://sdn.geekzu.org/avatar/57d8260dfb55501c37dde588e7c3852c'
}
//可通过 var fdataUser 替换默认值
if(typeof(fdataUser) !=="undefined"){
  for(var key in fdataUser) {
    if(fdataUser[key]){
      fcdata[key] = fdataUser[key];
    }
  }
}
var article_num = 0, sortNow = '', UrlNow = '', friends_num = 0
var container = document.getElementById('fcircleContainer') || document.getElementById('cf-container');
var feedGeneration = 0, nextPagePromise = null, nextPageKey = '', loadingMore = false, profileRequestId = 0;

function fetchFcircleJson(url) {
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  });
}

function setFeedFeedback(message, retry) {
  var feedback = document.getElementById('cf-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.id = 'cf-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    container.parentNode.insertBefore(feedback, container);
  }
  feedback.replaceChildren();
  feedback.hidden = !message;
  if (!message) return;
  var label = document.createElement('span');
  label.textContent = message;
  feedback.appendChild(label);
  if (retry) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = '重新加载';
    button.addEventListener('click', retry);
    feedback.appendChild(button);
  }
}

function setMoreState(message, disabled) {
  var button = document.getElementById('cf-more');
  if (!button) return;
  button.textContent = message;
  button.disabled = Boolean(disabled);
}
// 获取本地 排序值、加载apiUrl，实现记忆效果
var localSortNow = localStorage.getItem("sortNow")
var localUrlNow = localStorage.getItem("urlNow")
if(localSortNow && localUrlNow){
  sortNow = localSortNow
  UrlNow = localUrlNow
}else{
  sortNow = fcdata.article_sort
  if(fcdata.jsonurl){
    UrlNow = fcdata.apipublicurl+'postjson?jsonlink='+ fcdata.jsonurl+"&"
  }else if(fcdata.apiurl){
    UrlNow = fcdata.apiurl+'all?'
  }else{
    UrlNow = fcdata.apipublicurl+'all?'
  }
  console.log("当前模式："+UrlNow)
  localStorage.setItem("urlNow",UrlNow)
  localStorage.setItem("sortNow",sortNow)
}
// 打印基本信息
function loadStatistical(sdata){
  article_num = Number(sdata.article_num) || 0
  friends_num = Number(sdata.friends_num) || 0
  var messageBoard =`
  <div id="cf-state" class="cf-new-add">
    <div class="cf-state-data">
      <div class="cf-data-friends">
        <span class="cf-label">订阅友链</span>
        <span class="cf-message">${escapeFcircleHtml(sdata.friends_num)}</span>
      </div>
      <div class="cf-data-active">
        <span class="cf-label">活跃博主</span>
        <span class="cf-message">${escapeFcircleHtml(sdata.active_num)}</span>
      </div>
      <div class="cf-data-article">
        <span class="cf-label">收录文章</span>
        <span class="cf-message">${escapeFcircleHtml(sdata.article_num)}</span>
      </div>
    </div>
    <div class="cf-state-actions">
      <div id="cf-change" aria-label="文章排序">
        <button type="button" id="cf-change-created" data-sort="created" onclick="changeSort(event)" class="${sortNow == 'created' ? 'cf-change-now':''}" aria-pressed="${sortNow == 'created'}">最新发布</button>
        <button type="button" id="cf-change-updated" data-sort="updated" onclick="changeSort(event)" class="${sortNow == 'updated' ? 'cf-change-now':''}" aria-pressed="${sortNow == 'updated'}">最近更新</button>
      </div>
      <button type="button" class="cf-subscriptions" onclick="openToShow()">查看订阅</button>
      <button type="button" class="cf-refresh" onclick="clearLocal()" title="清除本页缓存并重新获取文章">刷新文章</button>
      ${fcdata.jsonurl || fcdata.apiurl ? '<button type="button" class="cf-source" onclick="changeEgg()">切换文章源</button>' : ''}
    </div>
  </div>
  `;
  var loadMoreBtn = `
    <button type="button" id="cf-more" class="cf-new-add" onclick="loadNextArticle()">加载更多文章</button>
    <div id="cf-footer" class="cf-new-add">
     <span id="cf-version-up" onclick="checkVersion()"></span>
     <span class="cf-data-lastupdated">数据更新于：${escapeFcircleHtml(sdata.last_updated_time || '未知')}</span>
    </div>
    <div id="cf-overlay" class="cf-new-add" onclick="closeShow()"></div>
    <div id="cf-overshow" class="cf-new-add"></div>
  `;
  if(container){
    container.insertAdjacentHTML('beforebegin', messageBoard);
    container.insertAdjacentHTML('afterend', loadMoreBtn);
  }
}
// 打印文章内容 cf-article
function loadArticleItem(datalist,start,end){
  var articleItem = '';
  var articleNum = article_num;
  var endFor = end
  if(end > articleNum){endFor = articleNum}
  if(start < articleNum){
    for (var i = start;i<Math.min(endFor, datalist.length);i++){
      var item = datalist[i];
      articleItem +=`
      <div class="cf-article">
        <a class="cf-article-title" href="${escapeFcircleHtml(safeFcircleUrl(item.link))}" target="_blank" rel="noopener nofollow" data-title="${escapeFcircleHtml(item.title)}">${escapeFcircleHtml(item.title)}</a>
        <span class="cf-article-floor">${escapeFcircleHtml(item.floor)}</span>
        <div class="cf-article-avatar no-lightbox flink-item-icon">
          <a onclick="openMeShow(event)" data-link="${escapeFcircleHtml(safeFcircleUrl(item.link))}" class="" target="_blank" rel="noopener nofollow" href="javascript:;"><img class="cf-img-avatar avatar" src="${escapeFcircleHtml(safeFcircleUrl(item.avatar))}" alt="avatar" onerror="this.onerror=null;this.src='/img/friend_404.gif'"><span class="cf-article-author">${escapeFcircleHtml(item.author)}</span></a>
          <span class="cf-article-time">
            <span class="cf-time-created" style="${sortNow == 'created' ? '':'display:none'}">${escapeFcircleHtml(item.created)}</span>
            <span class="cf-time-updated" style="${sortNow == 'updated' ? '':'display:none'}"><i class="fas fa-history">更新于</i>${escapeFcircleHtml(item.updated)}</span>
          </span>
        </div>
      </div>
      `;
    }
    container.insertAdjacentHTML('beforeend', articleItem);
    if (container.querySelectorAll('.cf-article').length < article_num) fetchNextArticle().catch(function () {})
    else setMoreState('已显示全部文章', true)
  }else{
    setMoreState('已显示全部文章', true)
  }
}
// 打印个人卡片 cf-overshow
function loadFcircleShow(userinfo,articledata){
  var showHtml = `
      <div class="cf-overshow">
        <div class="cf-overshow-head">
          <img class="cf-img-avatar avatar" src="${escapeFcircleHtml(safeFcircleUrl(userinfo.avatar))}" alt="avatar" onerror="this.onerror=null;this.src='/img/friend_404.gif'">
          <a class="" target="_blank" rel="noopener nofollow" href="${escapeFcircleHtml(safeFcircleUrl(userinfo.link))}">${escapeFcircleHtml(userinfo.name)}</a>
        </div>
        <div class="cf-overshow-content">
  `
  for (var i = 0;i<Math.min(Number(userinfo.article_num) || 0, articledata.length);i++){
    var item = articledata[i];
    showHtml += `
      <p><a class="cf-article-title" href="${escapeFcircleHtml(safeFcircleUrl(item.link))}" target="_blank" rel="noopener nofollow" data-title="${escapeFcircleHtml(item.title)}">${escapeFcircleHtml(item.title)}</a><span>${escapeFcircleHtml(item.created)}</span></p>
    `
  }
  showHtml += '</div></div>'
  document.getElementById('cf-overshow').insertAdjacentHTML('beforeend', showHtml);
  document.getElementById('cf-overshow').className = 'cf-show-now';
}

// 预载下一页；点击发生在预载完成前时，复用同一个请求。
function fetchNextArticle(){
  var start = container.querySelectorAll('.cf-article').length;
  if (start >= article_num) {
    setMoreState('已显示全部文章', true);
    return Promise.resolve([]);
  }
  var end = Math.min(start + Number(fcdata.stepnumber || 30), article_num);
  var key = [feedGeneration, UrlNow, sortNow, start].join('|');
  if (nextPagePromise && nextPageKey === key) return nextPagePromise;
  nextPageKey = key;
  setMoreState(loadingMore ? '加载中…' : '准备下一页…', loadingMore);
  nextPagePromise = fetchFcircleJson(UrlNow + 'rule=' + sortNow + '&start=' + start + '&end=' + end)
    .then(function (json) {
      var articles = parseArticleData(json.article_data);
      if (!articles.length) throw new Error('下一页没有返回文章');
      if (nextPageKey === key && !loadingMore) setMoreState('加载更多文章', false);
      return articles;
    })
    .catch(function (error) {
      if (nextPageKey === key) {
        nextPagePromise = null;
        setMoreState('加载失败，点击重试', false);
      }
      throw error;
    });
  return nextPagePromise;
}
// 显示下一页文章。
function loadNextArticle(){
  if (loadingMore) return;
  loadingMore = true;
  var generation = feedGeneration;
  setMoreState('加载中…', true);
  fetchNextArticle().then(function (nextArticle) {
    if (generation !== feedGeneration || !nextArticle.length) return;
    var articleItem = ""
    for (var i = 0;i<nextArticle.length;i++){
      var item = nextArticle[i];
      articleItem +=`
      <div class="cf-article">
        <a class="cf-article-title" href="${escapeFcircleHtml(safeFcircleUrl(item.link))}" target="_blank" rel="noopener nofollow" data-title="${escapeFcircleHtml(item.title)}">${escapeFcircleHtml(item.title)}</a>
        <span class="cf-article-floor">${escapeFcircleHtml(item.floor)}</span>
        <div class="cf-article-avatar no-lightbox flink-item-icon">
          <a onclick="openMeShow(event)" data-link="${escapeFcircleHtml(safeFcircleUrl(item.link))}" class="" target="_blank" rel="noopener nofollow" href="javascript:;"><img class="cf-img-avatar avatar" src="${escapeFcircleHtml(safeFcircleUrl(item.avatar))}" alt="avatar" onerror="this.onerror=null;this.src='/img/friend_404.gif'"><span class="cf-article-author">${escapeFcircleHtml(item.author)}</span></a>
          <span class="cf-article-time">
            <span class="cf-time-created" style="${sortNow == 'created' ? '':'display:none'}">${escapeFcircleHtml(item.created)}</span>
            <span class="cf-time-updated" style="${sortNow == 'updated' ? '':'display:none'}"><i class="fas fa-history">更新于</i>${escapeFcircleHtml(item.updated)}</span>
          </span>
        </div>
      </div>
      `;
    }
    container.insertAdjacentHTML('beforeend', articleItem);
    if (typeof lazyLoadInstance !== 'undefined') lazyLoadInstance.update();
    nextPagePromise = null;
    loadingMore = false;
    if (container.querySelectorAll('.cf-article').length < article_num) {
      fetchNextArticle().catch(function () {});
    } else {
      setMoreState('已显示全部文章', true);
    }
  }).catch(function (error) {
    if (generation === feedGeneration) console.warn('朋友圈下一页加载失败', error);
  }).finally(function () {
    if (generation === feedGeneration) loadingMore = false;
  });
}
// 清空本地数据
function clearLocal(){
  localStorage.removeItem("updatedArticleData")
  localStorage.removeItem("createdArticleData")
  localStorage.removeItem("nextArticle")
  localStorage.removeItem("statisticalData")
  localStorage.removeItem("sortNow")
  localStorage.removeItem("urlNow")
  location.reload();
}
//
function checkVersion(){
  if (!fcdata.apiurl) return;
  var url = fcdata.apiurl+"version"
  fetchFcircleJson(url)
    .then(json =>{
      var nowStatus = json.status,nowVersion = json.current_version,newVersion = json.latest_version
      var versionID = document.getElementById('cf-version-up')
      if (!versionID) return;
      if(nowStatus == 0){
        versionID.textContent = "当前版本：v"+ nowVersion
      }else if(nowStatus == 1){
        versionID.textContent = "发现新版本：v"+ nowVersion + " ↦ " + newVersion
      }else{
        versionID.textContent = "版本信息暂不可用"
      }
  }).catch(function () {
    var versionID = document.getElementById('cf-version-up');
    if (versionID) versionID.textContent = '版本信息暂不可用';
  });
}
// 切换为公共全库
function changeEgg(){
  //有自定义json或api执行切换
  if(fcdata.jsonurl || fcdata.apiurl ){
    feedGeneration++;
    nextPagePromise = null;
    loadingMore = false;
    document.querySelectorAll('.cf-new-add').forEach(el => el.remove());
    localStorage.removeItem("updatedArticleData")
    localStorage.removeItem("createdArticleData")
    localStorage.removeItem("nextArticle")
    localStorage.removeItem("statisticalData")
    container.innerHTML = ""
    UrlNow = localStorage.getItem("urlNow")
    var changeUrl;
    //console.log("新"+UrlNow)
    var UrlNowPublic = fcdata.apipublicurl+'all?'
    if(UrlNow !== UrlNowPublic){ //非完整默认公开库
      changeUrl = fcdata.apipublicurl+'all?'
    }else{
      if(fcdata.jsonurl){
        changeUrl = fcdata.apipublicurl+'postjson?jsonlink='+ fcdata.jsonurl+"&"
      }else if(fcdata.apiurl){
        changeUrl = fcdata.apiurl+'all?'
      }
    }
    localStorage.setItem("urlNow",changeUrl)
    FetchFriendCircle(sortNow,changeUrl)
  }else{
    clearLocal()
  }
}
// 首次加载文章
function FetchFriendCircle(sortNow,changeUrl){
  var generation = ++feedGeneration;
  nextPagePromise = null;
  nextPageKey = '';
  loadingMore = false;
  document.querySelectorAll('.fcircle_page .cf-new-add').forEach(function (el) { el.remove(); });
  container.innerHTML = '';
  setFeedFeedback('正在加载友链文章…');
  var end = fcdata.initnumber
  var fetchUrl = UrlNow + "rule="+sortNow+"&start=0&end="+end
  if(changeUrl){
    fetchUrl = changeUrl + "rule="+sortNow+"&start=0&end="+end
  }
  //console.log(fetchUrl)
  fetchFcircleJson(fetchUrl)
    .then(json =>{
      if (generation !== feedGeneration) return;
      var statisticalData = json.statistical_data;
      var articleData = parseArticleData(json.article_data);
      if (!statisticalData || typeof statisticalData !== 'object') throw new Error('统计数据格式无效');
      if (Number(statisticalData.article_num) > 0 && !articleData.length) throw new Error('文章数据为空');
      var articleSortData = sortNow+"ArticleData";
      loadStatistical(statisticalData);
      loadArticleItem(articleData ,0,end)
      localStorage.setItem("statisticalData",JSON.stringify(statisticalData))
      localStorage.setItem(articleSortData,JSON.stringify(articleData))
      setFeedFeedback(articleData.length ? '' : '目前还没有收录文章，稍后再来看看。');
    }).catch(function (error) {
      if (generation !== feedGeneration) return;
      console.warn('朋友圈文章加载失败', error);
      setFeedFeedback('友链文章暂时无法加载，请稍后重试。', function () {
        FetchFriendCircle(sortNow, changeUrl);
      });
    })
}
// 点击切换排序
function changeSort(event){
  if (sortNow === event.currentTarget.dataset.sort) return;
  sortNow = event.currentTarget.dataset.sort
  localStorage.setItem("sortNow",sortNow)
  feedGeneration++;
  nextPagePromise = null;
  loadingMore = false;
  document.querySelectorAll('.cf-new-add').forEach(el => el.remove());
  container.innerHTML = "";
  var changeUrl = localStorage.getItem("urlNow")
  //console.log(changeUrl)
  initFriendCircle(sortNow,changeUrl)
  if(fcdata.apiurl){
    checkVersion()
  }
}
//查询个人文章列表
function openMeShow(event){
  event.preventDefault()
  var parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
  var meLink = event.currentTarget.dataset.link.replace(parse_url, '$1:$2$3')
  console.log(meLink)
  var fetchUrl = ''
  if(fcdata.apiurl){
    fetchUrl = fcdata.apiurl + "post?link="+meLink
  }else{
    fetchUrl = fcdata.apipublicurl + "post?link="+meLink
  }
  //console.log(fetchUrl)
  if(noClick == 'ok'){
    noClick = 'no'
    fetchShow(fetchUrl)
  }
}
// 关闭 show
function closeShow(){
  profileRequestId++;
  noClick = 'ok';
  document.getElementById('cf-overlay').classList.remove('cf-show-now');
  document.getElementById('cf-overshow').classList.remove('cf-show-now');
  document.getElementById('cf-overshow').innerHTML = ''
}
// 点击开往
var noClick = 'ok';
function openToShow(){
  var fetchUrl = ''
  if(fcdata.apiurl){
    fetchUrl = fcdata.apiurl + "post"
  }else{
    fetchUrl = fcdata.apipublicurl + "post"
  }
  //console.log(fetchUrl)
  if(noClick == 'ok'){
    noClick = 'no'
    fetchShow(fetchUrl)
  }
}
// 展示个人文章列表
function fetchShow(url){
  var requestId = ++profileRequestId;
  var closeHtml = `
    <div class="cf-overshow-close" onclick="closeShow()"></div>
  `
  document.getElementById('cf-overshow').innerHTML = '';
  document.getElementById('cf-overlay').className = 'cf-show-now';
  document.getElementById('cf-overshow').insertAdjacentHTML('afterbegin', closeHtml);
  document.getElementById('cf-overshow').className = 'cf-show-now';
  document.getElementById('cf-overshow').insertAdjacentHTML('beforeend', '<div class="cf-overshow cf-profile-feedback" role="status">正在加载博主文章…</div>');
  fetchFcircleJson(url)
    .then(json =>{
      if (requestId !== profileRequestId) return;
      var statisticalData = json.statistical_data;
      var articleData = parseArticleData(json.article_data);
      if (!statisticalData || typeof statisticalData !== 'object') throw new Error('博主数据格式无效');
      document.querySelector('#cf-overshow .cf-profile-feedback')?.remove();
      loadFcircleShow(statisticalData,articleData)
    }).catch(function (error) {
      if (requestId !== profileRequestId) return;
      console.warn('博主文章加载失败', error);
      var feedback = document.querySelector('#cf-overshow .cf-profile-feedback');
      if (!feedback) return;
      feedback.textContent = '博主文章暂时无法加载。';
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重新加载';
      retry.addEventListener('click', function () { noClick = 'no'; fetchShow(url); });
      feedback.appendChild(retry);
    }).finally(function () {
      if (requestId === profileRequestId) noClick = 'ok';
    })
}
// 初始化文章列表。
function initFriendCircle(sortNow,changeUrl){
  container.innerHTML = "";
  FetchFriendCircle(sortNow,changeUrl)
}
// 执行初始化
initFriendCircle(sortNow)
