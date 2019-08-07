#!/bin/bash
git pull
node station.js
for i in {-3..5}; do
	node schedule d $i
	sleep 5
done
git add .
git commit -m "data update `date`"
git push
