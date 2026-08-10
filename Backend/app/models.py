from django.db import models

class Movies(models.Model):
    movie_id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    genre = models.CharField(max_length=50, blank=True, null=True)
    poster_image = models.CharField(max_length=255)
    is_available = models.IntegerField(default=1)
    rating = models.DecimalField(max_digits=2, decimal_places=1, blank=True, null=True)
    imdb_rating = models.DecimalField(max_digits=2, decimal_places=1, blank=True, null=True)
    date_added = models.DateTimeField(auto_now_add=True)
    quantity = models.IntegerField(default=0)
    stock = models.IntegerField(default=0)
    tmdb_id = models.CharField(max_length=50, blank=True, null=True)
    imdb_id = models.CharField(max_length=20, blank=True, null=True)
    rental_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    backdrop_image = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'movies'

    def __str__(self):
        return self.title

class Orders(models.Model):
    id = models.AutoField(primary_key=True)
    order_id = models.CharField(max_length=100, unique=True)
    razorpay_order_id = models.CharField(max_length=100, blank=True, null=True)
    payment_id = models.CharField(max_length=100, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=50, default='pending')
    items = models.TextField(blank=True, null=True)
    customer_details = models.TextField(blank=True, null=True)
    signature = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'orders'

    def __str__(self):
        return f"Order {self.order_id}"

class SessionCarts(models.Model):
    id = models.AutoField(primary_key=True)
    session_id = models.CharField(max_length=255)
    movie_id = models.IntegerField()
    quantity = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'session_carts'

    def __str__(self):
        return f"Session {self.session_id} - Movie {self.movie_id}"

class Users(models.Model):
    user_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=255)
    is_logged_in = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'

    def __str__(self):
        return self.name