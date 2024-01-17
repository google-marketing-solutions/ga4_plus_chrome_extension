# Analytics+ 

The GA4+ Chrome extension is intended to enable various capabilities in GA4 that are not available either in the UI or the API. This is an extremely experimental solution and may not work as expected or at all.

## Features

| Feature type    | Capabilities                                              |
| --------------- | --------------------------------------------------------- |
| Custom Reports  | Copy, Update across properties.                           |

## Loading the Extension Internally

To use the extension, please complete the following steps:

1. Download the files in this repository
1. Open chrome://extensions
1. Click "Load Unpacked"
1. Select the folder you downloaded
1. Click the extensions icon in your toolbar and pin the "Analytics+" extension icon to your toolbar

## Custom Reports

### Create

1. Navigate to your GA4 property
1. Navigate to the custom report you want to copy or create a new custom report
1. Click on the Analytics+ icon. The following should occur:
    1. A side panel should appear on the right hand side of your Analytics tab
    1. A bar at the top of your tab should appear saying the following:
        1. "Analytics+" started debugging this browser

1. Click the option to edit the custom report you want to copy across properties
1. Click on "Save… > Save changes to current report"
    1. After clicking save, the report name and type should appear in the side panel under "Resources"
    1. If you want to remove a report from this list, click the trash icon

1. Repeat steps 4 - 5 for each report you want to copy across properties
1. Enter the template property ID
    1. NOTE: For custom reports that contain custom dimensions, the extension will only be able to create new reports in the destination property 

1. Enter a list of properties in the "Destination Property IDs" text box
    1. Property IDs should be either separated by commas or placed on separate lines

1. Click on "Create Reports"
    1. The script will now create the selected reports for each property ID. Each request is sent in two second intervals. The responses for each request will be logged under "Responses".

1. Export CSV
    1. Once all the reports are created, click the button with the download icon to download a CSV file that will contain a list of all of the reports you created

### Update

1. Navigate to your GA4 property
1. Navigate to the custom report you want to update
1. Click on the Analytics+ icon. The following should occur:
    1. A side panel should appear on the right hand side of your Analytics tab
    1. A bar at the top of your tab should appear saying the following:
        1. "Analytics+" started debugging this browser
1. Edit the custom report.
1. Click on "Save… > Save changes to current report"
    1. After clicking save, the report name and type should appear in the side panel under "Resources"
    1. If you want to remove a report from this list, click the trash icon
1. Repeat steps 4 - 5 for each report you want to update.
1. Enter the template property ID.
1. Change the Action to "Update"
1. Upload the CSV file that contains the mappping between the reports you selected and the reports to be updated.
1. Click submit.