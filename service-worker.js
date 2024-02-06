/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const RequestType = {
  customReport: 'custom-report',
  userDimensions: 'user-dimensions',
  customDefinitions: 'custom-definitions'
};

/**
 * Adds a listener to the tab when it is updated. If the tab URL contains
 * analytics.gogle.com, then a sidebar will be added.
 */
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  // Enables the side panel on analytics.google.com
  if (/analytics\.google\.com/.test(url.origin)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'side_panel.html',
      enabled: true
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});

/**
 * Adds a click listener to the current tab. If the tab URL contains
 * analytics.google.com, then the debugger is attached to the tab and the
 * side panel is opened on the tab. If the tab URL does not contain
 * analytics.google.com, the the side panel is closed.
 */
chrome.action.onClicked.addListener(function (tab) {    
  if (/analytics\.google\.com/.test(tab.url)) {
    // Attach debugger to the tab.
    chrome.debugger.attach({ tabId: tab.id }, '1.2', function () {
      chrome.debugger.sendCommand(
        {tabId: tab.id },'Network.enable', {}, function () {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
          }
        }
      );
    });
    chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: 'side_panel.html',
      enabled: true
    });
    chrome.sidePanel.open({tabId: tab.id});
  } else {
    // Disables the side panel on all other sites
    chrome.sidePanel.setOptions({enabled: false});
  }
});

/**
 * Adds an event listener for requests that will be sent. If a request URL
 * contains various values, then the request data will be sent in a message.
 */
chrome.debugger.onEvent.addListener(function (source, method, params) {
  if (method === 'Network.requestWillBeSent') {
    requestData = getRequestData(params);
    if (requestData.valid) {
      chrome.runtime.sendMessage(requestData.message);
    }
  }
});

/**
 * Checks if the request is valid for the purposes of Analytics+ and if it is,
 * constructs the message to be sent to the side panel.
 * @return {!Object} Returns information used to send the request data to the
 * side panel.
 */
function getRequestData(params) {
  // Checks if a request URL is for updating custom reports.
  if (/reportconfig/.test(params.request.url) && 
      params.request.postData && 
      params.request.method == 'PUT') {
        const postData = JSON.parse(params.request.postData);
        return {
          valid: true,
          message: {
            name: RequestType.customReport,
            data: {
              name: postData.report.name || postData.report.linkedId,
              request: params.request,
              requestType: RequestType.customReport
            }
          }
        };
  } else {
    return {valid: false};
  }
}

/**
 * Adds a message listener. If the name of the message is correct, then this
 * will send out a request to other properties to create resources in the
 * selected properties based on the data in the message.
 */
chrome.runtime.onMessage.addListener(async ({name, data}) => {
  if (name === 'action-start') {
    const requests = data.requests;
    // Checks if there are requests to be sent.
    if (requests.length > 0) {
      // Loops through the requests.
      for (let index = 0; index < requests.length; index++) {
        const request = requests[index];
        let method = '';
        if (request.actionType == 'create') {
          method = 'POST';
        } else if (request.actionType == 'update') {
          method = 'PUT';
        } else if (request.actionType == 'delete') {
          method = 'PUT';
        }
        const newRequest = request.request;
        let statusCode = '';
        let postData = '';
        let response = {};
        // Sends the request and waits for a response.
        if (request.actionType == 'create' || 
            request.actionType == 'update') {
          response = await fetch(request.url, {
            headers: newRequest.headers,
            referrer: 'https://analytics.google.com/analytics/web/',
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: newRequest.postData,
            method: method,
            mode: 'cors',
            credentials: 'include'
          }).then((response) => {
            statusCode = response.status; 
            return response.body})
            .then((rb) => newStream(rb))
            .then((stream) =>
            new Response(stream).text(),
          ).then((result) => {      
            const objResult = JSON.parse(result.slice(5).trim());
            return objResult;
          });
          postData = JSON.parse(newRequest.postData);
        }
        // Sends a message that the resource request has a response.
        chrome.runtime.sendMessage({
          name: 'request-responses',
          data: responseMessageData(
            request.requestType, response, request, postData, statusCode)
        });
        // Sends action complete message when the 
        if (index + 1 == requests.length) {
          chrome.runtime.sendMessage({
            name: `action-complete`
          });
        }
        await sleep(2000);
      }
    }
  }
});

/**
 * Constructs the data to be sent with in a message when a response occurs.
 * @param {string} requestType The the request type for the resulting response.
 * @param {!Object} response The response of the request.
 * @param {!Object} request The initial request.
 * @param {!Object} postData The payload of the initial request.
 * @param {number} code The status code of the response.
 * @return {!Object} The message data.
 */
function responseMessageData(requestType, response, request, postData, code) {
  if (requestType == RequestType.customReport) {
    return {
      code: code,
      requestType: requestType,
      resourceName: postData.report.name || postData.report.linkId,
      propertyId: request.propertyId,
      resourceId: response.default.report.id,
      response: response,
      originalResourceId: postData.report.id
    };
  } else {
    return {};
  }
}

/**
 * Creates a new stream.
 */
function newStream(rb) {
  const reader = rb.getReader();
  return new ReadableStream({
    start(controller) {
      function push() {
        reader.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
          push();
        });
      }
      push();
    },
  });
}

async function sleep(time) {
  await new Promise(resolve => setTimeout(resolve, time));
  return 'done';
}