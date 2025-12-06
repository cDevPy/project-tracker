from django.urls import path
from . import views

app_name = 'projects'

urlpatterns = [
    path('', views.index, name='index'),
    path('create/', views.create_task, name='create_task'),
    path('create-project/', views.create_project, name='create_project'),
    path('delete/<int:id>/', views.delete_task, name='delete_task'),
    path('edit-task/<int:id>/', views.edit_task, name='edit_task'),
    path('invite/', views.invite_member, name='invite'),
    path('all/', views.project_hub, name='project_hub'),
    path('view/<int:id>/', views.project_detail, name='project_detail'),
    path('delete-project/<int:id>/', views.delete_project, name='delete_project'),
]