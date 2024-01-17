/**
 * Copyright 2023 Google LLC
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

let resourcesList = [];
let responseList = [];
const RequestType = {
  customReport: 'custom-report',
  userDimensions: 'user-dimensions',
  customDefinitions: 'custom-definitions'
};
const UrlPrefixes = {
  'custom-report': 'https://analytics.google.com/analytics/app/data/v2/reporting/reportconfig?dataset=p'
}
let actionType = 'create';

/**
 * Gets the value for a given ID and removes whitespaces from the beginning and
 * end of the value.
 * @param {sring} id The ID for a given DOM element.
 * @return {string} The value of the DOM element.
 */
function getIdElementValue(id) {
  const element = document.getElementById(id);
  return element.value.trim();
}

/**
 * Builds a list of the selected resources.
 */
function buildSelectedResourceList() {
  const listElementId = `resource-list`;
  document.getElementById(listElementId).innerHTML = '';
  for (let index = 0; index < resourcesList.length; index++) {
    const resource = resourcesList[index];
    document.getElementById(listElementId).innerHTML +=
      `<tr index="${index}"><td><span class="resource-name">${resource.name}</span></td><td><span class="resource-type">${resource.requestType}</span></td><td><span class="material-symbols-outlined remove-resource">
delete
</span></td></tr>`;
  }
  if (resourcesList.length == 0) {
    document.getElementById('action-button').disabled = true;
  } else {
    document.getElementById('action-button').disabled = false;
  }
  setRemoveSelectedResourceListener();
}

/**
 * Removes a resource from list of selected resources.
 */
function setRemoveSelectedResourceListener() {
  const removeButtons = document.getElementsByClassName('remove-resource');
  for (let i = 0; i < removeButtons.length; i++) {
    const button = removeButtons[i];
    button.addEventListener('click', function() {
      const index = this.parentElement.getAttribute('index');
      resourcesList.splice(index, 1);
      buildSelectedResourceList();
    });
  }
}

/**
 * Builds a request URL for a given request type.
 * @param {string} propertyId The destination property for the request.
 * @param {string} originalUrl The original URL for the request.
 * @param {string} requestType The request type.
 * @param {string} existingResourceId The ID for an existing resource.
 * @return {string} The URL for the new request.
 */
function buildRequestUrl(
  propertyId, originalUrl, requestType, existingResourceId) {
  let urlSuffix = originalUrl.split('&');
  urlSuffix.shift();
  urlSuffix = urlSuffix.join('&');
  if (!existingResourceId) {
    return `${UrlPrefixes[requestType]}${propertyId}&${urlSuffix}`;
  } else {
    const newPrefix = UrlPrefixes[requestType].replace(
      '?', `/${existingResourceId}?`);
    return `${newPrefix}${propertyId}&${urlSuffix}`;
  }
}

/**
 * Adds a message listener to Chrome.
 */
chrome.runtime.onMessage.addListener(({name, data}) => {
  if (Object.values(RequestType).indexOf(name) > -1) {
    // Push resource to the resource list to be used later.
    resourcesList.push({
      url: data.request.url,
      request: data.request,
      name: data.name,
      requestType: data.requestType,
      originalResourceId: data.originalResourceId
    });
    // Add the resource to the resource list element.
    buildSelectedResourceList();
  } else if (name == 'request-responses') {
    document.getElementById('responses').innerHTML += 
      generateResponseListHTML(data);
    responseList.push(data);
    if (responseList.length == 0) {
      document.getElementById('generate-csv').disabled = true;
      document.getElementById('clear-responses').disabled = true;
    }
    document.getElementById('action-count').innerText = responseList.length;
  } else if (name == 'action-complete') {
    // Reset the create report button once all reports have been created.
    const actionButton = document.getElementById('action-button');
    actionButton.setAttribute('aria-busy', 'false');

    document.getElementById('generate-csv').disabled = false;
    document.getElementById('clear-responses').disabled = false;
  }
});

/**
 * Generates the HTML elements for various resource request responses.
 * @param {!Object} data The message data object for the response.
 * return {string} The HTML element to be added based on the response.
 */
function generateResponseListHTML(data) {
  if (data.requestType == RequestType.customReport) {
    if (data.code == 200) {
      // Add a successful report to the response list.
      const linkUrl = `https://analytics.google.com/analytics/web/#/p${data.propertyId}/assetlibrary/explorer/edit?r=${data.resourceId}`;
      return `<tr class="success"><td>${data.code}</td><td><a href="${linkUrl}" target="_blank">${data.resourceName}</a></td><td>${data.requestType}</td><td>${data.propertyId}</td></tr>`;
    } else {
      // Add a failed report to the response list.
      return `<tr class="error"><td>${data.code}</td><td>${data.resourceName}</td><td>${data.requestType}</td><td>${data.propertyId}</td></tr>`;
    }
  }
}

/**
 * Adds a content loaded event listener.
 */
document.addEventListener('DOMContentLoaded', async function() {
  
  const clearResponsesButton = document.getElementById('clear-responses');
  clearResponsesButton.addEventListener('click', clearResponses);
  const generateCSVButton = document.getElementById('generate-csv');
  generateCSVButton.addEventListener('click', createCSV);
  const actionTypeSelection = document.getElementById('action-type');
  actionTypeSelection.addEventListener('change', changeActionType)
  const managementForm = document.getElementById('management-form');
  const csvFileInput = document.getElementById('csv-file');  
  const actionButton = document.getElementById('action-button');
  csvFileInput.addEventListener('change', () => {
    actionButton.disabled = false;
  });
  managementForm.addEventListener('submit', takeAction); 
  
});

/**
 * Lists data for a particular resource.
 * @param {string} propertyId The property ID for the resource.
 * @param {string} requestType The type of resource.
 * @param {string} token The token value from the GA frontend.
 * @return {!Array} An array of resource values.
 */
async function getData(propertyId, requestType, token) {
  const requestUrls = {
    'user-dimensions': `https://analytics.google.com/analytics/app/data/v2/reporting/customdefinitions/user?dataset=p${propertyId}&gamonitor=gafe&hl=en_US&state=app.reports.assetlibrary.explorer_edit`,
    'custom-definitions': `https://analytics.google.com/analytics/app/data/v2/reporting/customdefinitions?dataset=p${propertyId}&gamonitor=gafe&hl=en_US&state=app.reports.assetlibrary.explorer_edit`
  }
  const newHeaders = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-ua-mobile": "?0",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "none",
    "x-gafe4-xsrf-token": token
  };
  return await fetch(requestUrls[requestType], {
    "headers": newHeaders,
    "referrer": "https://analytics.google.com/analytics/web/",
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
  }).then((response) => response.body)
    .then((rb) => newStream(rb))
    .then((stream) =>
      new Response(stream).text(),
    )
    .then((result) => {      
      const objResult = JSON.parse(result.slice(5).trim());
      return objResult.default.items;
    });
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

/**
 * Swaps the custom dimension and metric slots in custom report from the 
 * template values to the destination property values. The custom dimensions and
 * metrics must have exactly the same names in both the template and destination
 * properties.
 * @param {!Array} templateValues An array of the template custom dimension and
 * custom metric values.
 * @param {!Array} newValues An array of the destination property custom
 * dimension and metric values.
 * @param {!Object} postData The payload for the resource request.
 * @return {!Objcet} The updated payload for the resource request where the
 * slots for the custom dimension and metric values have been updated.
 */
function swapDimensionSlots(templateValues, newValues, postData) {
  const postDataObj = JSON.parse(postData);
  const cards = postDataObj.report.cards;
  // Loop through the card settings.
  cards.forEach(card => {
    // Loop through the dictionary keys in each card object.
    for (key in card.card) {
      const values = card.card[key];
      if (values.length > 0) {
        values.forEach(value => {
          if (key == 'metric') {
            if (/Group1/.test(value)) {
              const metricIndex = parseInt(`1${value.id.slice(-2)}`);
              const templateMetricName = templateValues.customDefinitions.find(
                definition => metricIndex == definition.index).name;
              const newPropertyMetricIndex = newValues.customDefinitions.find(
                definition => templateMetricName == definition.name).index;
              value = `customMetricsGroup1Slot${newPropertyMetricIndex.toString().slice('-2')}`;
            }
          } else if (key == 'dimension') {
            if (/Group1/.test(value)) {
              const dimensionIndex = parseInt(`${value.id.slice(-2)}`);
              const templateDimensionName = templateValues.userProperties.find(
                definition => dimensionIndex == definition.index).name;
              const newPropertyDimensionIndex = newValues.userProperties.find(
                definition => templateDimensionName == definition.name).index;
              value = `customDimensionsGroup1Slot${newPropertyDimensionIndex.toString()}`; 
            } else if (/Group2/.test(value)) {
              const dimensionIndex = parseInt(`${value.id.slice(-2)}`);
              const templateDimensionName=templateValues.customDefinitions.find(
                definition => dimensionIndex == definition.index).name;
              const newPropertyDimensionIndex=newValues.customDefinitions.find
                (definition => templateDimensionName == definition.name).index;
              value = `customDimensionsGroup2Slot${newPropertyDimensionIndex.toString()}`; 
            }
          }
        });
      }
    }
  });
  return JSON.stringify(postDataObj);
}

/**
 * Creates a CSV from the responseList array.
 */
function createCSV() {
  const headers = [
    'original_resource_id',
    'resource_id',
    'property_id',
    'status_code',
    'resource_type',
    'resource_name'    
  ];
  const reformattedResourceResponses = responseList.reduce((arr, response) => {
    arr.push([
      response.originalResourceId,
      response.resourceId,
      response.propertyId,
      response.code,
      response.requestType,
      response.resourceName      
    ]);
    return arr;
  }, []).join('\n');
  let csv = [headers, reformattedResourceResponses].join('\n');
  const contentType = 'text/csv';
  const csvFile = new Blob([csv], {type: contentType});
  const downloadLink = document.getElementById('csv-link');
  
  downloadLink.download = 'responses.csv';
  downloadLink.href = window.URL.createObjectURL(csvFile);

  downloadLink.dataset.downloadurl = `${contentType}:${downloadLink.download}:${downloadLink.href}`;
  downloadLink.click();
}

/**
 * Removes responses from the responses table, disables the generate-csv button,
 * and disables the clear-responses button
 */
function clearResponses() {
  responseList = [];
  document.getElementById('generate-csv').disabled = true;
  document.getElementById('clear-responses').disabled = true;
  document.getElementById('responses').innerHTML = '';
  document.getElementById('counts').style.visibility = 'hidden';
}

/**
 * Changes the action type to either 'update', 'delete', or 'create. The
 * button text is also changed.
 */
function changeActionType() {
  actionType = this.value;
  const csvFileInput = document.getElementById('csv-file');
  const destinationPropertyIds = document.getElementById('property-ids');
  if (this.value == 'update' || this.value == 'delete') {
    csvFileInput.disabled = false;
    destinationPropertyIds.disabled = true;
  } else if (this.value == 'create') {
    csvFileInput.disabled = true;
    destinationPropertyIds.disabled = false;
  }
}

/**
 *
 */
async function parseCSV() {
  return new Promise(resolve => {
    const csvFileInput = document.getElementById('csv-file'); 
    const input = csvFileInput.files[0];
    const reader = new FileReader();
    reader.onload = function(event) {
      const tempArray = event.target.result.trim().split('\n').map(
        value => value.split(','));
      let keys = tempArray.shift();
      const arrayOfObjects = tempArray.reduce((arr, row) => {
        const tempObj = {};
        keys.forEach((key, index) => tempObj[key] = row[index]);
        arr.push(tempObj);
        return arr;
      }, []);
      resolve(arrayOfObjects);
    };
    reader.readAsText(input);
  });
}

/**
 *
 */
async function takeAction(event) {
  event.preventDefault();
  
  const totalActions = document.getElementById('total-actions');
  
  // Get the responses element.
  document.getElementById('responses').innerHTML = '';
  
  responseList = [];
  const templatePropertyId = getIdElementValue('template-property-id');
  
  let ids = getIdElementValue('property-ids').split(/,|\n/);
  
  if (actionType == 'create') {
    totalActions.innerText = resourcesList.length * ids.length;
  }
  
  // Loop through the list of reports to be copied.
  let currentAction = 0;
  if (resourcesList.length > 0) {
    // Set the button so that it is busy.
    const actionButton = document.getElementById('action-button');
    actionButton.setAttribute('aria-busy', 'true');
    actionButton.innerText = 'Working...';
    
    document.getElementById('counts').style.visibility = 'visible';
    
    const requestList = [];
    if (actionType == 'create') {
      if (ids.length > 0) {
        // Loop through the properties the resources are to be created in.
        for (let index = 0; index < ids.length; index++) {
          const destinationPropertyId = ids[index];
          let templatePropertyDefinitionsCustomReport = null;
          let destinationPropertyDefinitionsCustomReport = null;
          let previousPropertyIdCustomReport = null;
          
          for (let i = 0; i < resourcesList.length; i++) {
            const resource = resourcesList[i];
            let destinationRequestUrl = '';
            // Build custom report request.
            if (resource.requestType == RequestType.customReport) {
              const customReportData = await buildCustomReportData(
                destinationPropertyId,
                previousPropertyIdCustomReport,
                templatePropertyDefinitionsCustomReport,
                destinationPropertyDefinitionsCustomReport,
                templatePropertyId,
                resource
              );
              
              templatePropertyDefinitionsCustomReport = 
              customReportData.templatePropertyDefinitions;
              destinationPropertyDefinitionsCustomReport = 
              customReportData.destinationPropertyDefinitions;
              previousPropertyIdCustomReport = 
              customReportData.previousPropertyId;
              
              requestList.push({
                url: customReportData.destinationRequestUrl,
                request: customReportData.resource.request,
                propertyId: destinationPropertyId,
                actionType: actionType,
                requestType: customReportData.resource.requestType
              });
            } else {
              // Add new create logic here.
            }
            // Push to the request list.
            
          }
        }
      }
    } else if (actionType == 'update') {
      // Loops through the uploaded CSV file to create requests.
      const csvData = await parseCSV();
      for (let i = 0; i < resourcesList.length; i++) {
        const resource = resourcesList[i];
        const requestBody = JSON.parse(resource.request.postData);
        if (resource.requestType == RequestType.customReport) {
          // Finds resources that match the selected report ID.
          const matchedResources = csvData.filter(
            csvResource => {
              if (csvResource.original_resource_id == requestBody.report.id &&
                csvResource.resource_type == RequestType.customReport) {
                  return csvResource;
                }
            });
            console.log(matchedResources);
          // Loop through any matched resources.
          if (matchedResources.length > 0) {
            let templatePropertyDefinitions = null;
            let destinationPropertyDefinitions = null;
            let previousPropertyId = null;
            
            for (let index = 0; index < matchedResources.length; index++) {
              const currentResource = matchedResources[index];
              const destinationPropertyId = currentResource.property_id;
              const customReportData = await buildCustomReportData(
                destinationPropertyId,
                previousPropertyId,
                templatePropertyDefinitions,
                destinationPropertyDefinitions,
                templatePropertyId,
                resource,
                currentResource.resource_id
              );
              
              templatePropertyDefinitions =
              customReportData.templatePropertyDefinitions;
              destinationPropertyDefinitions = 
              customReportData.destinationPropertyDefinitions;
              previousPropertyId = 
              customReportData.previousPropertyId;
              
              requestList.push({
                url: customReportData.destinationRequestUrl,
                request: customReportData.resource.request,
                propertyId: destinationPropertyId,
                actionType: actionType,
                requestType: customReportData.resource.requestType
              });
            }
          }
        } else {
          
        }
      }
    }
    chrome.runtime.sendMessage({
      name: 'action-start',
      data: {
        requests: requestList
      }
    });
  }
}

/**
 *
 */
async function buildCustomReportData(
  destinationPropertyId,
  previousPropertyId,
  templatePropertyDefinitions,
  destinationPropertyDefinitions,
  templatePropertyId,
  resource,
  existingResourceId) {
  // Get template property custom definitions.
  if (templatePropertyDefinitions == null) {
    templatePropertyDefinitions = await {
      userDimensions: await getData(
        templatePropertyId,
        RequestType.userDimensions,
        resource.request.headers['x-gafe4-xsrf-token']),
      customDefinitions: await getData(
        templatePropertyId,
        RequestType.customDefinitions,
        resource.request.headers['x-gafe4-xsrf-token'])
    }
  }
  // If the current property ID is different that the previous
  // requests property ID, then get the current property ID's custom
  // defintions.
  if (previousPropertyId != destinationPropertyId) {
    destinationPropertyDefinitions = await {
      userDimensions: await getData(
        destinationPropertyId,
        RequestType.userDimensions,
        resource.request.headers['x-gafe4-xsrf-token']),
      customDefinitions: await getData(
        destinationPropertyId,
        RequestType.customDefinitions,
        resource.request.headers['x-gafe4-xsrf-token'])
    };
  }
  // Sets the new group and slot IDs for custom metrics and
  // dimensions.
  resource.request.postData = swapDimensionSlots(
    templatePropertyDefinitions,
    destinationPropertyDefinitions,
    resource.request.postData
  );

  // Sets the destination request URL.
  destinationRequestUrl = buildRequestUrl(
    destinationPropertyId,
    resource.url,
    RequestType.customReport,
    existingResourceId
  );
  
  // Sets the existing resource ID for the postData.
  if (actionType == 'update') {
    const parsedPostData = JSON.parse(resource.request.postData);
    parsedPostData.report.id = existingResourceId.toString();
    resource.request.postData = JSON.stringify(parsedPostData);
  }

  return {
    templatePropertyDefinitions: templatePropertyDefinitions,
    destinationPropertyDefinitions: destinationPropertyDefinitions,
    resource: resource,
    previousPropertyIdCustomReport: destinationPropertyId,
    destinationRequestUrl: destinationRequestUrl
  }
}