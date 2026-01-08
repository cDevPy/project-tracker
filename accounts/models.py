from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=False)   # inactive until email activation

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email
    

class PasswordResetPIN(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    pin = models.CharField(max_length=4)
    created_at = models.DateTimeField(auto_now_add=True)


    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=10)
    
    def __str__(self):
        return f"{self.user.email} - {self.pin}"