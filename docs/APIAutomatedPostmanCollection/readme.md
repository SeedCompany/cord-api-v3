# Postman API Automation Test Collections

Collections are located in \docs\APIAutomatedPostmanCollection directory.

--------------------------

## Steps To Run Collection

--------------------------

### On Postman Application : 

#### Video : 
https://drive.google.com/file/d/1FMxcgkKB9IQsIpceALsGsp5Ic9N0SYmE/view?usp=drivesdk

#### Steps To Follow:

Step 1 : Import Collection to Postman

Step 2 : Import Local Environment Variables to Postman

Step 3 : Import Global Environment Variables to Postman

Step 4 : Run Your Collection

***** RUN OPTIONS *****

- You can select specific folder to run requests 

- You can select your Environemt (Environment ? Global : local) from menu

- check 'iterations 'options to give delay between 2 requests

- check 'Delay' option to give delay between 2 requests

- check 'Save responses' to save responses of your requests to check reponse body later.

Then hit "RUN" to go. Results will be shown on screen as run progresses.

--------------------------

### Via Command Line Using Newman : 

You should have Postman collection, environment variables(global/local) exported from Postman to a directory

#### Video : 
https://drive.google.com/file/d/1Ddt-nI6YTrRD2WJO7_ep6LFdeY6JccJB/view?usp=drivesdk

#### Steps To Follow:

Step 1 : 
Install newman to your Machine globally from [url](https://www.npmjs.com/package/newman)

Step 2:
Go to the directory where you’ve exported Collection, environment (global/local)

Step 3:
Open Visual Studio Code OR  Windows PowerShell OR Command Prompt and switch to your Collection directory path (as per Step 2)

Step 4:
Enter the Newman command and hit "Enter" e.g.

```newman run My_Test_Cord_Collection.postman_collection.json -e local.postman_environment.json -g MyWorkspace.postman_globals.json -r htmlextra --delay-request 500 -n 1```

Command Syntax: 
```newman run [collection_name] -e [local_enviroment_fileName] - g [global_enviroment_fileName] -r htmlextra --delay-request [time_in_ms] -n [number_of_iterations]```

Step 5:
Wohoo ! your newman report is generated :)
Generated HTML report will be automatically placed to Collection's directory (as per Step 2)

Note : Opening report may take some time based on size of your report (Report size varies with no. of requests in Collections, Test Scripts)

--------------------------