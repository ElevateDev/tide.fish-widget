mkdir build

# Depends on yui-compressor and node-less
# Build CSS
echo "#tideFishSchedule{" > build/style.less
cat style.css >> build/style.less
cat bootstrap.css >> build/style.less
echo "}" >> build/style.less
lessc build/style.less > build/style.css
yui-compressor build/style.css > build/style.min.css
rm build/style.less

# depends on uglifyjs
# minify js
uglifyjs widget.js > build/widget.min.js 
