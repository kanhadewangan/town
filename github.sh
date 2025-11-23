
set -e 

echo "Github Pushing "

git add .

echo "Enter commit message: "

read commitMessage
git commit -m "$commitMessage"

echo "Enter branch name: "
read branchName
git push origin "$branchName"
echo "Pushed to github successfully to branch $branchName" 

exit 0
