from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup, name='accounts.signup'),
    path('login/', views.userLogin, name='accounts.login'),
    path('logout/', views.userLogout, name='accounts.logout'),
    path('account-access/', views.access, name='accounts.access'),
]
