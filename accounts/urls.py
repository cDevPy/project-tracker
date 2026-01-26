from django.urls import path
from . import views
from django.urls import path


urlpatterns = [
    path('signup/', views.signup, name='accounts.signup'),
    path('login/', views.userLogin, name='accounts.login'),
    path('logout/', views.userLogout, name='accounts.logout'),
    path('account-access/', views.access, name='accounts.access'),
    path('resend-activation-email/', views.resend_activation_email, name='accounts.resend_activation_email'),
    path('activate/<uidb64>/<token>/', views.activate_account, name='accounts.activate'),
    path('activation-success/',views.activation_success, name='activation.success'),
    path('check-email/', views.check_email, name='accounts.check_email'),
    path('password-reset/',views.password_reset_request, name='password_reset_request'),
    path('password-reset/verify/', views.password_reset_verify, name='password_reset_verify'),
    path('password-reset/form/', views.password_reset_form, name='password_reset_form'),

]

