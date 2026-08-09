from django.contrib import admin
from .models import Movies, Orders, SessionCarts, Users

@admin.register(Movies)
class MoviesAdmin(admin.ModelAdmin):
    list_display = ('movie_id', 'title', 'genre', 'price', 'rating', 'is_available', 'stock')
    search_fields = ('title', 'genre')
    list_filter = ('genre', 'is_available')

@admin.register(Orders)
class OrdersAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'amount', 'payment_method', 'status', 'created_at')
    search_fields = ('order_id', 'payment_id', 'razorpay_order_id')
    list_filter = ('status', 'payment_method')

@admin.register(SessionCarts)
class SessionCartsAdmin(admin.ModelAdmin):
    list_display = ('id', 'session_id', 'movie_id', 'quantity', 'updated_at')
    search_fields = ('session_id',)

@admin.register(Users)
class UsersAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'name', 'email', 'is_logged_in', 'created_at')
    search_fields = ('name', 'email')
