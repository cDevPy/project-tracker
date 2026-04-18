from django.urls import path
from . import views


app_name = 'projects'   # ← Recommended (namespace)

urlpatterns = [
    # Your existing invite URL
    path('invite/<int:project_id>/', views.send_project_invite, name='send_invite'),
    path('invites/accept/<str:token>/', views.accept_invitation, name='accept_invitation'),
]
        

    