I spoke with Carson before he left about what we needed to do here to get the PDF files feeding through to the IRP frontend, and here is what he said we needed to do. 

Carson Full [1:42 PM]
Well the easiest path I think is to just make the multiplication report files anonymous/public. I’m not sure whats in those and if that’s the most secure/accepted thing though.

Carson Full [1:49 PM]
Here’s (/src/components/location/location.repository.ts) where we create Location’s map image as public/anonymous.

Brent Kulwicki [3:51 PM]
Per Seth, this route is fine, but I am thinking that if I make the fileUrls public like in my PR, it will be more than just these multiplication PDFs that will be affected, right? From the way Rob has talked about it, more than just these files are a part of this right?

Carson Full [4:15 PM]
Yes. And unfortunately this is in an pretty abstract spot

[4:16 PM]And it doesn’t follow the same file abstraction either

[4:16 PM]https://github.com/SeedCompany/cord-api-v3/blob/develop/src/components/periodic-report/periodic-report.repository.ts#L148-L166 (reference src/components/periodic-report/periodic-report.repository.ts#L148-L166)

[4:16 PM]You would need to filter report to be ProgressReports and parent to be Multiplication Projects - these are from the method’s input parameter

[4:17 PM]Then you’d add the public initialProp
```
name: variable('apoc.temporal.format(interval.end, "date")'),
+ public: true,
```
[4:18 PM] 4 year old code. Sorry man
