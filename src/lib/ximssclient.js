/**
 * Created by Alexander.Ustilov on 02.11.2015.
 */

//var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var http = require('http');
var log = require('../lib/log')(module);
var DOMParser = require('xmldom').DOMParser;

function XIMSSSession(params,theOpenCallback) {
  var errorCode           = null;

  var theSessionRef       = this;

  var MaxBufferedRequests = 10;
  var ximssRequestSeqId   = 0;
  var isDead = false,isAlive = false,isClosed = false;

  var asyncRegistry        = new XIMSSListenerRegistry;
  var asyncUnknown         = null;
  
  var pendingRequests     = new Object;
  var collectedReqIds     = new Array;
  var sendCollectedNow    = false;

  var initialXMLs         = new Array;

  function callback(theRef, theMethod) {
    return function () {return(theMethod.apply(theRef, arguments));}
  }

  var debugMethod = null;
  var debugObject = null;

  function debugFunction() {
    if(debugMethod != null) debugMethod.apply(debugObject,arguments);
  }

  function debugLog(x) {debugFunction("XIMSS",x);}
  //function debugLog(x) {log.debug(x);}

  this.createRequest      = function(tagName) {throw "not implemented";}
  this.setDebugFunction   = function(newDebugObject,newDebugMethod) {
    debugMethod = newDebugMethod;
    debugObject = newDebugObject;
  }

  function canAssign(x,y) {return((x == null) != (y == null));}


  this.setAsyncProcessor = function(theRef,newCallback,theTagName,theAttrName,theAttrValue) {
    if(newCallback != null && theRef != null) newCallback = callback(theRef,newCallback);
    return(asyncRegistry.registerCallback(newCallback,theTagName,theAttrName,theAttrValue));
  }

  this.setUnknownAsyncProcessor = function(theRef,newCallback) {
    if(newCallback != null && theRef != null) newCallback = callback(theRef,newCallback);
    var retCode = canAssign(newCallback,asyncUnknown);
    if(retCode) {asyncUnknown = newCallback;}
    return(retCode);
  }


  var  netErrorCallback      = null,
       netErrorTimeReported  = new Date(),
       netErrorTimeLimit     = 0;

  this.setNetworkErrorProcessor = function(theRef,newCallback,timeLimit) {
    if(newCallback != null && theRef != null) newCallback = callback(theRef,newCallback);
    var retCode = canAssign(newCallback,this.netErrorCallback);
    if(retCode) {netErrorCallback = newCallback; netErrorTimeLimit = (timeLimit == null ? 10 : timeLimit);}    
    return(true);
  }

  function reportNetworkError(isFatal,elapsed) {
    if(isDead) return(true);
    var thisTime = new Date();
    if(isFatal || (netErrorCallback != null && netErrorTimeReported + netErrorTimeLimit*1000 < thisTime)) {
      isFatal |= netErrorCallback(isFatal,elapsed/1000);
      netErrorTimeReported = thisTime;
    }
    if(isFatal) {interruptAllPending();}
    return(!isFatal);
  }
  
  var sendRequestAndUnlock = function() {throw "not implemented";}
  var startConnection      = function() {throw "not implemented";}
  var interruptConnection  = function() {throw "not implemented";}

  this.sendRequest = function(xmlRequest,theRef,dataCallback,finalCallback,sendImmediately) {
    if(theRef != null) {
      if(dataCallback  != null) dataCallback  = callback(theRef,dataCallback);
      if(finalCallback != null) finalCallback = callback(theRef,finalCallback);
    }
  
    ximssRequestSeqId %= 1000000;                         // limit to 6 digits, we hope there would be no coflict
    var theSeqId  = '' + ++ximssRequestSeqId;
    xmlRequest.setAttribute("id",theSeqId);

    // if the session is already dead, return an error immediately, and do nothing more
    if(isDead || !isAlive || isClosed) {
      if(finalCallback != null) finalCallback("communication error",xmlRequest);
      return;
    }

    var theRequest = pendingRequests[theSeqId] = new Object;
    theRequest.xmlRequest    = xmlRequest;
    theRequest.dataCallback  = dataCallback;
    theRequest.finalCallback = finalCallback;
    isClosed = xmlRequest.tagName == "bye";

    collectedReqIds.push(theSeqId);     
    sendCollectedNow |= ((sendImmediately !== false) || collectedReqIds.length >= MaxBufferedRequests);

    sendRequestAndUnlock();
  }

  function processXMLResponse(xmlResponse) {
    if(isDead) return;
 
    var theSeqId  = xmlResponse.getAttribute("id");
    if(theSeqId != null) {
      if(theSeqId != "noop") {
        var theDescr = pendingRequests[theSeqId];

        if(theDescr != null) {
          if(xmlResponse.tagName == "response") {
            delete pendingRequests[theSeqId];
            if(theDescr.xmlRequest.tagName == "bye") interruptAllPending();
            if(theDescr.finalCallback != null) theDescr.finalCallback(xmlResponse.getAttribute("errorText"),theDescr.xmlRequest);
          } else {
            if(theDescr.dataCallback != null) theDescr.dataCallback(xmlResponse,theDescr.xmlRequest);
          }
        }
      }

    } else if(xmlResponse.tagName == "bye") {
      debugLog("BYE received");
      reportNetworkError(true,0);

    } else {                                                         // no "id" attribute -> async message
      debugLog("async xmlResponse=" + xmlResponse.tagName);
      if(!asyncRegistry.callCallbacks(xmlResponse)) {
        if(asyncUnknown != null) asyncUnknown(xmlResponse);
      }
    }
  }

  function clearCollectedRequestsUnderLock() {
    while(collectedReqIds.length != 0) collectedReqIds.pop();
    sendCollectedNow = false;
  }

  function interruptAllPending() {
    isDead = true;
    debugLog("session closed");
    clearCollectedRequestsUnderLock();
    
    while(pendingRequests.length > 0) {
      theDescr = pendingRequests.shift();
      if(theDescr.finalCallback != null) theDescr.finalCallback("communication error",theDescr.xmlRequest); 
    }
    interruptConnection();
  }


  this.start = function() {
    if(isDead || isAlive) {return;}

    while(initialXMLs.length != 0) processXMLResponse(initialXMLs.shift());
    isAlive = true;
    startConnection();
  }

  this.close = function(theRef,finalCallback) {
    this.sendRequest(this.createXMLNode("bye"),theRef,null,finalCallback,true);
  }

  //
  // HTTP implementation
  //
  function HTTPBinding() {
  
    var httpBaseURL;
    var httpPOSTTimeOut =10,asyncGetWaitInSeconds = 15;
    var useAsyncPost,useNoAsync;
  
    var sendBatchSeqId = 0,readBatchAckId = 0;
    var POSTInProgress  = false;
    var POSTHTTPRequest = null,GETHTTPRequest = null;

    var currentPOSTURL  = null, currentGETURL = null;
    var currentPOSTBody = null;
    var currentPOSTErrors = 0,currentGETErrors = 0;
    var currentPOSTComposed, currentGETComposed;
    var currentPOSTStarted,  currentGETStarted;
    
    var POSTTimer       = null,GETTimer = null;

    var doc = new DOMParser().parseFromString('<XIMSS></XIMSS>');
    var POSTXMLDocument = doc.documentElement;

    var sessionLost = "you have been disconnected";
    function isFatalError(errorCode) {
      return(errorCode == sessionLost);
    }

     function debugLog(x) {debugFunction("HTTP",x);}

    function composePOSTUnderLock() { 
      currentPOSTURL = httpBaseURL + (params.asyncMode == "asyncPOST" ? "async" : "sync") + "?reqSeq=" + ++sendBatchSeqId;
      if(params.asyncMode == "noAsync") {currentPOSTURL += "&syncAsync=1";}

      for(var x; (x = POSTXMLDocument.firstChild) != null;) POSTXMLDocument.removeChild(x);
      currentPOSTBody = POSTXMLDocument.createElement("XIMSS");
      debugLog("POST composed for " + collectedReqIds.length + " requests");
      if(collectedReqIds.length > 0) {
        for(var i = 0; i < collectedReqIds.length; ++i) {
          currentPOSTBody.appendChild(pendingRequests[collectedReqIds[i]].xmlRequest); 
        }
      } else {
        var xmlNoop = POSTXMLDocument.createElement("noop");
        xmlNoop.setAttribute("id","noop");
        currentPOSTBody.appendChild(xmlNoop);
      }
      POSTXMLDocument.appendChild(currentPOSTBody);
      currentPOSTBody = POSTXMLDocument;

      clearCollectedRequestsUnderLock();

      currentPOSTErrors   = 0;
      currentPOSTComposed = netErrorTimeReported = new Date();

      POSTInProgress = true;
    }

    function startComposedPOST() {
      currentPOSTStarted = new Date();
      POSTTimer          = setTimeout(processPOSTTimeout,httpPOSTTimeOut*1000);
      POSTHTTPRequest    = startHTTPRequest(processPOSTCompletion,"POST",currentPOSTURL,currentPOSTBody);
      debugLog("POST sent");
    }

    function startNoopPOST() {
      if(!POSTInProgress) {
        POSTTimer = null;
        composePOSTUnderLock();
        startComposedPOST();
      }
    }

    function processPOSTTimeout() {
      debugLog("POST time-out");
      cancelHTTPRequest(POSTHTTPRequest); POSTHTTPRequest = null;
      POSTTimer = null;
      processPOSTCompletion(null,"request time-out");
    }
  
    function processPOSTCompletion(xmlData,errorCode) {
      debugLog("POST completed" + (errorCode == null ? "" : " errorCode="+errorCode));
      if(POSTTimer != null) {clearTimeout(POSTTimer); POSTTimer = null;}
      POSTHTTPRequest = null;
      var isFatal = isFatalError(errorCode);

      if(errorCode == null && params.asyncMode != "asyncPOST") {
        if(xmlData == null) {
          errorCode = "no XML in POST response";
        } else {
          for(var i = 0; i < xmlData.childNodes.length; ++i) {
            processXMLResponse(xmlData.childNodes[i]);
          }
        }
      }

      if(isDead) {                                        // we have been closed/suspended
        POSTInProgress = false;
      } else if(errorCode == null) {
        POSTInProgress = false;
        if(sendCollectedNow) {
          composePOSTUnderLock();
          startComposedPOST();
        } else if(params.pollPeriod != null) {
          POSTTimer = setTimeout(startNoopPOST,params.pollPeriod*1000);
        }
      } else {
        ++currentPOSTErrors;
        if(!reportNetworkError(isFatal,new Date - currentPOSTComposed)) {
          POSTInProgress = false;
          return;
        }

        var delayTime = 
          currentPOSTErrors >= 20 ? 10000 : 
          currentPOSTErrors >= 10 /*|| errorCode == "no network available" */? 5000 :
          currentPOSTErrors >= 5  /*|| errorCode == "no route to host"     */? 2000 : 
                                                                               200; 

        delayTime = (currentPOSTStarted - new Date()) + delayTime;
        if(delayTime < 100) delayTime = 100;
        debugLog("POST paused for " + delayTime + " msecs");
        POSTTimer = setTimeout(startComposedPOST,delayTime);
      }
    }

    sendRequestAndUnlock = function() {
      if(POSTInProgress || !sendCollectedNow) {
//      theLock.XUnlock();
        debugLog("delaying POST");
        return;
      }
      if(POSTTimer != null) {clearTimeout(POSTTimer); POSTTimer  = null;}
      composePOSTUnderLock();
      startComposedPOST();
    }

    function startComposedGET() {
      currentGETStarted = new Date();
      GETTimer          = setTimeout(processGETTimeout,(asyncGetWaitInSeconds+2)*1000);
      GETHTTPRequest    = startHTTPRequest(processGETCompletion,"GET",currentGETURL,null);
      debugLog("GET sent");
    }

    function composeAndStartGET() {
      currentGETURL = httpBaseURL + "?ackSeq="  + readBatchAckId + 
                                    "&maxWait=" + asyncGetWaitInSeconds;

      startComposedGET();
      currentGETComposed = netErrorTimeReported = new Date();
    }

    function processGETTimeout() {
      debugLog("GET time-out");
      GETHTTPRequest.aborted = true;
      cancelHTTPRequest(GETHTTPRequest); GETHTTPRequest = null;
      GETTimer = null;
      processGETCompletion(null,"request time-out");
    }

    function processGETCompletion(xmlData,errorCode) {
      debugLog("GET completed" + (errorCode == null ? "" : " errorCode="+errorCode) + (xmlData == null ? "" : " data: ") + xmlData);

      if(GETTimer != null) {clearTimeout(GETTimer); GETTimer = null;}
      GETHTTPRequest    = null;

      var isFatal       = isFatalError(errorCode);

      if(errorCode != null) {
      } else if(xmlData == null) {
        errorCode = "no XML in GET response";
      } else {
        var respReqAttr = xmlData.getAttribute("respSeq");
        if(respReqAttr != null) readBatchAckId = respReqAttr;
        for(var i = 0; i < xmlData.childNodes.length; ++i) {
          processXMLResponse(xmlData.childNodes[i]);
        }
      }
   
      if(!isAlive) {                                // we have been closed/suspended
        ;
      } else if(errorCode == null) {
        composeAndStartGET();
      } else {
        ++currentGETErrors;
        if(!reportNetworkError(isFatal,new Date() - currentGETComposed)) return;

        var delayTime = 
          currentGETErrors >= 20 && (theAsyncMode != "asyncPOST" || !POSTInProgress) ? 30000 : 
          currentGETErrors >= 10 /*|| errorCode == "no network available"*/ ? 5000 :
          currentGETErrors >= 5  /*|| errorCode == "no route to host"    */ ? 2000 : 
                                                                              200;
        delayTime = (currentGETStarted - new Date()) + delayTime;
        if(delayTime < 100) delayTime = 100;
        debugLog("GET paused for " + delayTime + " msecs");
        GETTimer = setTimeout(startComposedGET,delayTime);
      }
    }

    function startHTTPRequest(callback,method,aUrl,body) {

      //log.debug('Url: ' + url + '; Method: ' + method + '; Body: ' + body);
      var url = require("url");
      var urlObj = url.parse(aUrl);
      //log.debug('Original url: ' + aUrl + '; Path: ' + urlObj.path + '; Host: ' +urlObj.hostname + '; Method: ' + method + '; Body: ' + body);
      req = http.request(
          //url,
          {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.path,
            method: method
          },
          function(res){
        var errorCode = null;
        var ximssData = null;
        var xmlData = '';

        //log.debug('STATUS: ' + res.statusCode);
        //log.debug('HEADERS: ' + JSON.stringify(res.headers));
        if(res.statusCode == 0) {
          errorCode = "server communication error";
        } else if(res.statusCode == 550) {
          errorCode = sessionLost;
        } else if(res.statusCode < 200 || res.statusCode >= 300) {
          if((errorCode = res.statusText) == null) errorCode = "server protocol error";
        } /* else if(res.responseXML != null) {
          ximssData = res.responseXML.childNodes[0];
          if(ximssData.tagName != "XIMSS") {ximssData = null; errorCode = "server XML response is not XIMSS";}
          else if(POSTXMLDocument == null) POSTXMLDocument = res.responseXML;
        } else {
          if(res.responseText != null && res.responseText != "") errorCode = "server response is not XML";
        }*/
        res.on('data', function (chunk) {
          xmlData = xmlData + chunk;
          //log.debug('BODY: ' + chunk);
        });
        res.on('end', function () {
          log.debug('xmlData: ' + xmlData);
          if (xmlData == null || xmlData == ''){ callback(ximssData,errorCode); return;}
          var doc = new DOMParser().parseFromString(xmlData);
          ximssData = doc.childNodes[0];//.documentElement;

          if(doc.childNodes[0].tagName != "XIMSS") {ximssData = null; errorCode = "server XML response is not XIMSS";}
          else if(POSTXMLDocument == undefined || POSTXMLDocument == null || POSTXMLDocument.childNodes.length == 0) {
            POSTXMLDocument = doc;
            for(var x; (x = POSTXMLDocument.firstChild) != null;) POSTXMLDocument.removeChild(x);
            POSTXMLDocument.createElement("XIMSS");
            //log.debug('POSTXMLDocument was initialized');
          }

          callback(ximssData,errorCode);
        });
        //log.debug('XIMSS Data: ' + res.statusCode);
      });
      req.on('error',function(e){
        log.error('Error on http request: ' + e.message);
      });
      if(body){ req.write(body.toString()); }
      req.end();
      return (req);
    }

    /*function startHTTPRequest(callback,method,url,body) {
      var httpRequest = new XMLHttpRequest();

      httpRequest.open(method,url,true);
      httpRequest.onreadystatechange = function() {

        if(httpRequest.readyState != 4) return;
        if(httpRequest.aborted) return;

        var errorCode = null;
        var ximssData = null;
        if(httpRequest.status == 0) {
          errorCode = "server communication error";
        } else if(httpRequest.status == 550) {
          errorCode = sessionLost;
        } else if(httpRequest.status < 200 || httpRequest.status >= 300) {
          if((errorCode = httpRequest.statusText) == null) errorCode = "server protocol error";
        } else if(httpRequest.responseXML != null) {
          ximssData = httpRequest.responseXML.childNodes[0];
          if(ximssData.tagName != "XIMSS") {ximssData = null; errorCode = "server XML response is not XIMSS";}
          else if(POSTXMLDocument == null) POSTXMLDocument = httpRequest.responseXML;
        } else {
          if(httpRequest.responseText != null && httpRequest.responseText != "") errorCode = "server response is not XML";
        }
        callback(ximssData,errorCode);
      }
      httpRequest.send(body);
      return(httpRequest);
    }
*/
    function cancelHTTPRequest(httpRequest) {
      httpRequest.aborted = true;
      httpRequest.abort();
    }

    function loginHTTPPlainCompletion(xmlData,errorCode) {
      if(errorCode == null && xmlData == null) errorCode = "empty response on login";
    
      if(errorCode == null) {
        var xmlFirst = xmlData.childNodes[0];
        log.debug('XMLFirst: ' + xmlFirst.tagName);
        if(xmlFirst != null && xmlFirst.tagName == "response") {
          errorCode = xmlFirst.getAttribute("errorText");
        } else if(xmlFirst != null && xmlFirst.tagName == "session") {
          var theURL = xmlFirst.getAttribute("urlID");
          if(theURL != null) {
            httpBaseURL += "Session/" + theURL + "/"; 
            for(var i = 0; i < xmlData.childNodes.length; ++i) {
              initialXMLs.push(xmlData.childNodes[i]);
            }
          } else {
            errorCode = "the 'session' 'urlID' data is missing";
          }
        } else {
          errorCode = "the 'session' data is missing";
        }
      }
      if(theOpenCallback != null) theOpenCallback(errorCode == null ? theSessionRef : null,errorCode);
    }

    startConnection  = function() {
      if(params.asyncMode != "noAsync") composeAndStartGET();
    }

    interruptConnection = function() {
      if(POSTTimer != null) {clearTimeout(POSTTimer); POSTTimer  = null;}
      if(GETTimer  != null) {clearTimeout(GETTimer);  GETTimer   = null;}

      if(POSTHTTPRequest!= null) {debugLog("interrupting POST"); cancelHTTPRequest(POSTHTTPRequest); POSTHTTPRequest = null;}
      if(GETHTTPRequest != null) {debugLog("interrupting GET");  cancelHTTPRequest(GETHTTPRequest);  GETHTTPRequest  = null;}
    }

    
    theSessionRef.createXMLNode      = function(tagName) {
      if(POSTXMLDocument == null) throw "no POSTXMLDocument preserved";
      return(POSTXMLDocument.createElement(tagName));
    }
    theSessionRef.createTextNode     = function(text) {
      if(POSTXMLDocument == null) throw "no POSTXMLDocument preserved";
      return(POSTXMLDocument.createTextNode(text));
    }

    // constructor

    if(typeof(params.serverName) != "string") return("illegal XIMSS http binding parameters");

    if(params.loginMethod == "plain") {
      if(typeof(params.serverName) != "string") return("XIMSS userName is not specified");
      httpBaseURL = (params.secureMode == "YES" ? "https" : "http") + "://" + params.serverName + "/";
      loginURL    = httpBaseURL + "XIMSSLogin/?errorAsXML=1&userName="+params.userName;
      if(params.password != null) {loginURL += "&password="+params.password;}
      if(params["FixedIP"]   == "NO") {loginURL += "&DisableIPWatch=1";}
      if(params["UseCookie"] == "NO") {loginURL += "&DisableUseCookie=1";}

      startHTTPRequest(loginHTTPPlainCompletion,"GET",loginURL,null);
      return(null);
    }
    return("illegal XIMSS login method");
  }

 
  if(params.binding == "HTTP") {
    error = HTTPBinding();
  } else {
    errorCode = "illegal parameter";
  }
  if(errorCode != null && theOpenCallback != null) theOpenCallback(null,errorCode);
}

XIMSSSession.prototype.callback = function(theRef, theMethod) {
  return function () {return(theMethod.apply(theRef, arguments));}
}

//
// Callback Registry
//
function XIMSSListenerRegistry() {
  var anyTag   = null;
  var tags     = new Object;

  this.registerCallback = function(newCallback,theTagName,theAttrName,theAttrValue) {
    function canAssign(x,y) {return((x == null) != (y == null));}
 
    if(theTagName == null) {
      if(theAttrName != null || theAttrValue != null) {return(false);}
      if(!canAssign(newCallback,anyTag)) {return(false);}
      anyTag = newCallback;

    } else {
      var tagDescr = tags[theTagName];
      if(tagDescr == null) {
        if(newCallback == null) {return(false);}
        // creating a new tagDescr element
        tagDescr = tags[theTagName] = new Object;
        tagDescr.attrNames = null; tagDescr.anyAttr = null;
      }

      if(theAttrName != null) {
        var previous = null,attrNameDescr;
        for(;;) {
          attrNameDescr = previous == null ? tagDescr.attrNames : previous.next;
        if(attrNameDescr == null || attrNameDescr.name == theAttrName) break;
          previous = attrNameDescr;
        }
        if(attrNameDescr == null) {
          if(newCallback == null) {return(false);}
          attrNameDescr          = new Object;
          attrNameDescr.next     = null;
          attrNameDescr.name     = theAttrName;
          attrNameDescr.values   = new Object;
          attrNameDescr.nValues  = 0;
          attrNameDescr.anyValue = null;
          
          if(previous == null) tagDescr.attrNames = attrNameDescr;
          else                 previous.next      = attrNameDescr;
        }

        if(theAttrValue != null) {
          if(!canAssign(newCallback,attrNameDescr.values[theAttrValue])) {return(false);}
          if(newCallback != null) {attrNameDescr.values[theAttrValue] = newCallback; ++attrNameDescr.nValues;}
          else                    {delete attrNameDescr.values[theAttrValue]; --attrNameDescr.nValues;}
        } else {
          if(!canAssign(newCallback,attrNameDescr.anyValue)) {return(false);}
          attrNameDescr.anyValue = newCallback;
        }
        // if all callbacks for this attribute have been removed -> remove the attribute
        if(attrNameDescr.anyValue == null && attrNameDescr.nValues == 0) {
          if(previous == null) tagDescr.attrNames = attrNameDescr.next;
          else                 previous.next      = attrNameDescr.next;
        }
      } else {
        if(theAttrValue != null) return(false);                // if theAttrName == null, then theAttrValue must be null, too.
        if(!canAssign(newCallback,tagDescr.anyAttr)) {return(false);}
        tagDescr.anyAttr = newCallback;
      }
      // if all callbacks for this tag have been removed -> remove the tag
      if(tagDescr.anyAttr == null && tagDescr.attrNames == null) {
        delete tags[theTagName];
      }
    }
    return(true);
  }

  this.callCallbacks = function(xmlData) {
    var foundDescrs = new Array;

    var tagDescr = tags[xmlData.tagName];
    if(tagDescr != null) {
      for(var attrScan = tagDescr.attrNames;  attrScan != null; attrScan = attrScan.next) {
        var attrValue = xmlData.getAttribute(attrScan.name);
        if(attrValue != null) {
          var valueCallback = attrScan.values[attrValue];
          if(valueCallback     != null) foundDescrs.push(valueCallback);
          if(attrScan.anyValue != null) foundDescrs.push(attrScan.anyValue);
        }
      }
      if(tagDescr.anyAttr != null) foundDescrs.push(tagDescr.anyAttr);
    }
    if(anyTag != null) foundDescrs.push(anyTag);

    // now, process all found in the proper order.
    //  consider processed if retCode >= 0
    //  stop processing    if retCode >  0
    var processed = false;
    while(foundDescrs.length != 0) {
      var result = foundDescrs.shift()(xmlData);
      processed |= result >= 0;
    if(result > 0) break;
    }
    
    return(processed);
  }

}

module.exports = XIMSSSession;