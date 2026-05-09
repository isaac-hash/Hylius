import os
import django

try:
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glitchtip.settings')
    django.setup()
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        u = User.objects.get(email='admin@hylius.icu')
        u.set_password('112233445566778899aabbccddeeff00')
        u.save()
        print('SUCCESS: Password reset successfully')
    except User.DoesNotExist:
        print('SUCCESS: Creating new user...')
        User.objects.create_superuser('admin@hylius.icu', '112233445566778899aabbccddeeff00')
except Exception as e:
    print('ERROR:', e)
