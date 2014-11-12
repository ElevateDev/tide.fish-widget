# Depends on yui-compressor and node-less

echo "#tideFishSchedule{" > style.less
cat style.css >> style.less
cat bootstrap.css >> style.less
echo "}" >> style.less
lessc style.less > style-final.css
yui-compressor style-final.css > style-final.min.css
rm style.less
