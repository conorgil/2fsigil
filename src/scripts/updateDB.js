import storage from "./utils/storage";
import yaml from "js-yaml";

var refresh = function(fname, cb) {
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      try {
        cb(xhr.responseText);
      } catch(e) {
        console.log("failed to load file:", e);
        return
      }
    }
  };
  xhr.open("GET", fname, true);
  xhr.send();
}

var GetFiles = function() {
  return new Promise(function (resolve) {
    refresh("https://api.github.com/repositories/17724730/contents/_data/", function(dat) {
      var listing = JSON.parse(dat);
      var state = {inprogress: 0, files: [], done: resolve};
      state.complete = (function () {
        this.inprogress--;
        if (this.inprogress == 0) {
          this.done(this.files);
        }
      }).bind(state);
      listing.forEach(function (file) {
        state.inprogress++;
        state.files.push(file.name);
        GetFile(file.name, file.sha, state);
      });
    });
  });
}

var GetFile = function(name, hash, state) {
  storage.get('file/' + name, function(dat) {
    if (dat['file/' + name] !== undefined) {
      var cur = JSON.parse(dat['file/'  + name]);
      if(cur.hash == hash) {
        state.complete();
        return;
      }
    }
    refresh("https://raw.githubusercontent.com/2factorauth/twofactorauth/master/_data/" + name, (function(n, h, dat) {
      var doc = yaml.safeLoad(dat);
      doc.hash = h;
      var nm = {};
      var str = JSON.stringify(doc);
      nm["file/" + n] = str;
      storage.set(nm, function() {
        state.complete();
      });
    }).bind(this, name, hash));
  });
};

var Update = function(files) {
  return new Promise(function (resolve) {
    var domains = new Set();
    var links = {};
    var left = files.length;
    files.forEach(function(file) {
      storage.get('file/' + file, function(dat) {
        if (!dat || !dat['file/' + file]) {
          console.warn("File not stored: " + file);
          left--;
          return;
        }
        var dict = JSON.parse(dat['file/' + file]);
        if (!dict.websites || !dict.websites.forEach) {
          console.log("Unexpected structure in " + file)
          left--;
          return;
        }
        dict.websites.forEach(function(domain) {
          if (domain.tfa && domain.tfa != "No") {
            domains.add(domain.url);
          }
          if (domain.doc) {
            var url = new URL(domain.url);
            links[url.host] = domain.doc;
          } else if (domain.twitter) {
            var url = new URL(domain.url);
            links[url.host] = "https://twitter.com/share?url=" + url.host + "&amp;text=Security is important, @" + domain.twitter + ". We'd like it if you supported two factor auth.&amp;hashtags=SupportTwoFactorAuth";
          }
        });
        left--;
        if(left == 0) {
          resolve(domains);
        }
      });
    });
    module.exports.Domains = domains;
    module.exports.Links = links;
  });
}

module.exports = {GetFiles: GetFiles, GetFile: GetFile, Update: Update, Domains: new Set(), Links: {}};
