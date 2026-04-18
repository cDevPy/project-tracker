from django.urls import path
from.import views

urlpatterns =[
    path('mark-all-read/', views.mark_all_notifications_read, name='mark_all_read'),
    path('unread-count/', views.unread_count, name='unread_count'),
    path('all/', views.notifications_list, name='notifications_list'),
    path('clear-all/', views.clear_all_notifications, name='clear_all_notifications'),
    path('mark-read/<int:id>/', views.mark_notification_read,name='mark_notification_read'),
]


