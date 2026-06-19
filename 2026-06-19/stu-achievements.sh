# Put this in /etc/profile.d
ACHIEVEMENT_SERVER="http://localhost:3000"
achievement_user_id=$(curl -s $ACHIEVEMENT_SERVER/user?username=$USER |jq -r '.data.id')

# Let people know it exists
cat << EOF

🏆 HPC Achievements are enabled
- Use the cluster, unlock achievements and earn awards!
- See 'hpcstats' for your progress
- See 'hpcstats --locked' to see ones you haven't earned

EOF

# Multitasker (ID: 211)
if [[ $(w $USER --no-header |wc -l) -ge 5 ]] ;then
    achievement_got=$(curl -s "$ACHIEVEMENT_SERVER/user/has/achievement?id=$achievement_user_id&achievement=211" |jq -r '.data')
    if [[ $achievement_got == "false" ]] ; then
        echo "Achievement get: 🤹 Multitasker (have 5 active login sessions)"
        curl -s -X POST $ACHIEVEMENT_SERVER/user/achieved -H "Content-Type: application/json" -d "{\"id\":$achievement_user_id,\"achievement\":211}"
    fi
fi

# Show Achievement Progress
function hpcstats() {
	ACHIEVEMENT_SERVER="http://localhost:3000"
	STATS=$(curl -s localhost:3000/user/achievements?id=$achievement_user_id)
	if [[ "$1" == "--locked" ]] ; then
		ALL=$(curl -s localhost:3000/achievement)
		LOCKED=$(jq -r -n --argjson unlocked "$STATS" --argjson all "$ALL" '$unlocked.data.unlocked | map(.achievement_id) as $earned | $all.data | map(select(.id as $id | $earned | index($id) | not)) |.[] | "- \(.title) (\(.description))"')
		cat << EOF
======== 🔒 Locked HPC Achievements 🔒 ========
$LOCKED

EOF
	else
		unlock=$(echo "$STATS" |jq -r '.data.unlockedCount')
		total=$(echo "$STATS" |jq -r '.data.lockedCount')
		# requires bc
		progress=$(echo "scale=2;($unlock / $total) * 100" |bc)

		recent=$(echo "$STATS" |jq -r '.data.unlocked | sort_by(.unlocked_at) | reverse | .[:5] | .[] | "- \(.title) (\(.description))"')


		cat << EOF
======== 🏅 HPC Achievements 🏅 ========

📈 PROGRESS: $progress% ($unlock/$total)

🆕 RECENTLY UNLOCKED:
$recent

EOF
	fi
}
