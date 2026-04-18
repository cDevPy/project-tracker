from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Notification



@login_required
def mark_all_notifications_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return JsonResponse({'status': 'success'})


@login_required
def unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return JsonResponse({'count': count})



@login_required
def notifications_list(request):
    notifications = request.user.notifications.all()
    return render(request, 'notifications/notifications_list.html', {
        'notifications': notifications
    })


@login_required
def clear_all_notifications(request):
    deleted_count, _ = Notification.objects.filter(user=request.user).delete()
    return JsonResponse({'status': 'success', 'deleted': deleted_count})


@login_required
def mark_notification_read(request, id):
    Notification.objects.filter(id=id, user=request.user).update(is_read=True)
    return JsonResponse({'status': 'success'})