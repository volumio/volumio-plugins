#!/bin/sh
# Configure PAM modules | removed from setup, because it breaks authentication if DUO is not configured properly
echo "Trying to patch PAM configuration"

SSHD_TMP="/data/plugins/miscellanea/duo/templates/sshd"

if grep -q "duo" $SSHD_TMP; then
	echo "No patching needed"
else
	echo "Patching PAM configuration"	
	grep -qxF 'auth  required pam_permit.so' $SSHD_TMP || sed '/^@include common-auth.*/a auth  required pam_permit.so' -i $SSHD_TMP
	grep -qxF 'auth  requisite pam_deny.so' $SSHD_TMP || sed '/^@include common-auth.*/a auth  requisite pam_deny.so' -i $SSHD_TMP
	grep -qxF 'auth  [success=1 default=ignore] pam_duo.so' $SSHD_TMP || sed '/^@include common-auth.*/a auth  \[success=1 default=ignore\] pam_duo.so' -i $SSHD_TMP
fi

if [ -f "/data/plugins/miscellanea/duo/templates/disable_password" ]; then
	sed 's/^@include common-auth.*/#@include common-auth/g' -i $SSHD_TMP
else
	sed 's/^#@include common-auth.*/@include common-auth/g' -i $SSHD_TMP
fi