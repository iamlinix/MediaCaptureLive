
// Initialize a tracer function
var tracer = new Tracer('tracefield');
var time;

function Tracer(id) {
  this.el = document.getElementById(id);
}

Tracer.prototype.trace = function(msg) {
  var fragment = document.createDocumentFragment();
  var p = document.createElement('p');
  p.textContent = msg;
  fragment.appendChild(p);
  this.el.appendChild(fragment);
};

Tracer.prototype.clear = function() {
  this.el.textContent = '';
};

// Show the time in mm:hh:ss.ms format
function GetTime() {
   var dd = new Date();
   var hh = dd.getHours();
   var mm = dd.getMinutes();
   var ss = dd.getSeconds();
   var ms = dd.getMilliseconds();
   hh = ( hh < 10 ? "0" : "" )  + hh;
   mm = ( mm < 10 ? "0" : "" )  + mm;
   ss = ( ss < 10 ? "0" : "" )  + ss;
   ms = ( ms < 10 ? "00" : "" ) + ms;
   ms = ( ms < 100 && ms > 10 ? "0" : "" ) + ms;
   time = hh + ":" + mm + ":" + ss + "." + ms;
}
			
// This function is used for tracing
function trace(location, text) {
  GetTime();
  tracer.trace('- ' + time + ' - ' + location + ' -> ' + text);
}

