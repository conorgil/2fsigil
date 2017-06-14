import ext from "./utils/ext";
import db from "./updateDB";

ext.runtime.onInstalled.addListener(function() {
  ext.alarms.create("update", {
    "delayInMinutes": 0,
    "periodInMinutes": 60 * 24
  });
});

ext.alarms.onAlarm.addListener(function() {
  db.GetFiles().then(db.Update).then(updateRules);
});

ext.pageAction.onClicked.addListener(function(tab) {
  var host = new URL(tab.url).host;
  Object.keys(db.Links).forEach(function (dom) {
    if (host.endsWith(dom)) {
      ext.tabs.create({url: db.Links[dom]});
    }
  })
});

function updateRules(domains) {
  var conditions = [];
  domains.forEach(function(domain) {
    var url = new URL(domain).host;
    if (url.startsWith("www.")) {
      url = url.split("www.")[1];
    }
    conditions.push(new chrome.declarativeContent.PageStateMatcher({
      pageUrl: { hostSuffix: url },
    }));
  });

  chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: conditions,
        actions: [ new chrome.declarativeContent.SetIcon({
          "path": {
            "19": "icons/action-19.png",
            "38": "icons/action-38.png"
          }
        }) ]
      }
    ]);
  });
};
