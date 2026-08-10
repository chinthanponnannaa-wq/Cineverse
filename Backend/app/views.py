import os
import razorpay
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
import json
import random
import string
from openai import OpenAI
from datetime import datetime
from django.conf import settings

RAZORPAY_KEY_ID = getattr(settings, 'RAZORPAY_KEY_ID', '') or os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = getattr(settings, 'RAZORPAY_KEY_SECRET', '') or os.environ.get('RAZORPAY_KEY_SECRET', '')

razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

TMDB_GENRE_MAP = {
    28: 'Action', 12: 'Action', 16: 'Animation', 35: 'Cinema', 80: 'Crime',
    99: 'Cinema', 18: 'Drama', 10751: 'Animation', 14: 'Sci-Fi', 36: 'Drama',
    27: 'Crime', 10402: 'Cinema', 9648: 'Crime', 10749: 'Drama', 878: 'Sci-Fi',
    10770: 'Cinema', 53: 'Sci-Fi', 10752: 'Drama', 37: 'Action'
}

from django.core import signing

def generate_auth_token(user_id):
    return signing.dumps({"user_id": user_id})

def get_authenticated_user_id(request):
    auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION') or ''
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    elif 'X-Auth-Token' in request.headers:
        token = request.headers.get('X-Auth-Token').strip()
    else:
        token = request.GET.get('token') or request.POST.get('token')

    if not token:
        return None

    try:
        data = signing.loads(token, max_age=86400 * 30)
        return data.get('user_id')
    except Exception:
        return None

def resolve_tmdb_genre(genre_ids):
    if not genre_ids or not isinstance(genre_ids, list):
        return 'Cinema'
    for gid in genre_ids:
        if gid in TMDB_GENRE_MAP:
            return TMDB_GENRE_MAP[gid]
    return 'Cinema'

@csrf_exempt
def get_movies(request):
    if request.method == "GET":
        try:
            raw_page = request.GET.get('page')
            raw_limit = request.GET.get('limit')
            genre = request.GET.get('genre')
            sort = (request.GET.get('sort') or '').strip().lower()

            SORT_MAP = {
                'rating': 'rating DESC, movie_id ASC',
                'price-low': 'price ASC, movie_id ASC',
                'price-high': 'price DESC, movie_id ASC',
                'year': 'movie_id DESC',
                'featured': 'FIELD(movie_id, 2, 1, 3, 103, 5, 10, 11, 4) DESC, rating DESC, movie_id ASC'
            }
            order_by_sql = SORT_MAP.get(sort, 'movie_id ASC')

            params = []
            where_clauses = []

            if genre and genre.lower() != 'all':
                where_clauses.append("LOWER(genre) = LOWER(%s)")
                params.append(genre)

            where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            with connection.cursor() as cursor:
                count_sql = f"SELECT COUNT(*) FROM movies{where_sql}"
                cursor.execute(count_sql, params)
                total_count = cursor.fetchone()[0]

                query_sql = f"SELECT * FROM movies{where_sql} ORDER BY {order_by_sql}"

                is_paginated = raw_page is not None or raw_limit is not None
                p = 1
                l = 24
                if is_paginated:
                    try:
                        p = max(1, int(raw_page)) if raw_page else 1
                        l = max(1, min(100, int(raw_limit))) if raw_limit else 24
                    except ValueError:
                        p = 1
                        l = 24
                    offset = (p - 1) * l
                    query_sql += " LIMIT %s OFFSET %s"
                    params.extend([l, offset])

                cursor.execute(query_sql, params)
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                movie_items = []
                for row in rows:
                    movie_dict = dict(zip(columns, row))
                    m_id = movie_dict.get('movie_id')
                    movie_dict['movie_id'] = m_id
                    movie_dict['MovieID'] = m_id
                    movie_dict['title'] = movie_dict.get('title')
                    movie_dict['MovieName'] = movie_dict.get('title')
                    movie_dict['genre'] = movie_dict.get('genre') or 'Cinema'
                    movie_dict['Category'] = movie_dict.get('genre') or 'Cinema'
                    movie_dict['poster_image'] = movie_dict.get('poster_image') or ''
                    movie_dict['ImageName'] = movie_dict.get('poster_image') or ''
                    movie_dict['price'] = float(movie_dict.get('price') or 499.00)
                    movie_dict['Price'] = float(movie_dict.get('price') or 499.00)
                    movie_dict['rental_price'] = float(movie_dict.get('rental_price') or 149.00)
                    movie_dict['backdrop_image'] = movie_dict.get('backdrop_image') or movie_dict.get('poster_image') or ''
                    movie_dict['tmdb_id'] = movie_dict.get('tmdb_id')
                    movie_dict['description'] = movie_dict.get('description') or ''
                    movie_dict['Description'] = movie_dict.get('description') or ''
                    movie_dict['quantity'] = movie_dict.get('quantity', 0)
                    raw_tmdb_r = movie_dict.get('rating')
                    tmdb_r_val = float(raw_tmdb_r if raw_tmdb_r is not None else 8.0)
                    movie_dict['tmdb_rating'] = tmdb_r_val

                    raw_imdb_r = movie_dict.get('imdb_rating')
                    imdb_r_val = float(raw_imdb_r) if raw_imdb_r is not None else None
                    movie_dict['imdb_rating'] = imdb_r_val
                    movie_dict['imdb_id'] = movie_dict.get('imdb_id')

                    # Primary rating representation (imdb_rating if present, else tmdb_rating for backward compatibility)
                    movie_dict['rating'] = imdb_r_val if imdb_r_val is not None else tmdb_r_val
                    movie_dict['Rating'] = movie_dict['rating']
                    
                    movie_items.append(movie_dict)

            has_next = (p * l) < total_count

            if is_paginated:
                return JsonResponse({
                    "movies": movie_items,
                    "pagination": {
                        "page": p,
                        "limit": l,
                        "total": total_count,
                        "has_next": has_next
                    }
                })
            else:
                return JsonResponse(movie_items, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def process_voice(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            transcript = data.get('transcript', '')
            
            print("User said:", transcript)
            
            command_data = None
            try:
                openai_client = OpenAI(
                    api_key=os.environ.get('GROQ_API_KEY') or getattr(settings, 'GROQ_API_KEY', ''),
                    base_url="https://api.groq.com/openai/v1",
                )
                
                with connection.cursor() as cursor:
                    cursor.execute("SELECT title, price, genre FROM movies")
                    movie_db_data = cursor.fetchall()
                
                movie_list_str = "\n".join([f"- {title} (₹{price}) - {genre}" for title, price, genre in movie_db_data])
                
                prompt = f"""
You are an AI voice assistant for CineVerse, a premium movie purchasing and rental platform. The user said: "{transcript}"

IMPORTANT RULES:
1. The user may say multiple commands in one sentence.
2. You MUST respond to the LAST command you detect.
3. IGNORE all other previous commands.
4. Do NOT mention or acknowledge any other commands in your response.

Available movies in our database:
{movie_list_str}

Available pages/routes in our app:
- Home page (path: "/")
- About page (path: "/about")
- Login page (path: "/login")
- Cart page (path: "/cart")
- Checkout page with payment modal (path: "/cart#payment-modal")
- Orders/Library page (path: "/orders")
- Movies catalog section (path: "/#items")

Based on the user's voice input, respond with ONE of these command types:

1. If user wants to FILTER movies by genre (Action, Sci-Fi, Drama, Animation, Thriller, Crime):
{{
  "command": "FILTER",
  "category": "Action" or "Sci-Fi" or "Drama" or "Animation" or "Thriller" or "Crime",
  "response": "Showing you all Action movies"
}}

2. If user wants to NAVIGATE to a page:
{{
  "command": "NAVIGATE",
  "page": "home" or "about" or "login" or "cart" or "checkout" or "orders" or "menu" or "items",
  "path": "/" or "/about" or "/login" or "/cart" or "/cart#payment-modal" or "/orders" or "/#items",
  "response": "Taking you to the home page"
}}

3. If user wants to LOGIN:
{{
  "command": "NAVIGATE",
  "page": "login",
  "path": "/login",
  "response": "Taking you to the login page"
}}

4. If user wants to LOGOUT:
{{
  "command": "LOGOUT",
  "response": "Logging you out"
}}

5. If user wants to ORDER/BUY/RENT a movie:
{{
  "command": "ORDER",
  "items": [
    {{
      "name": "exact movie title",
      "quantity": number,
      "price": number
    }}
  ],
  "response": "Added movie to your cart"
}}

6. If user wants to REMOVE a movie from cart:
{{
  "command": "REMOVE",
  "items": [
    {{
      "name": "exact movie title",
      "quantity": number
    }}
  ],
  "response": "Removed movie from cart"
}}

7. If command is unclear:
{{
  "command": "UNKNOWN",
  "response": "I didn't understand. Please repeat."
}}

Return ONLY the JSON object, no additional text.
"""
                
                response = openai_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a helpful CineVerse movie purchasing assistant. Always respond with valid JSON only."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=500
                )
                
                print("AI Response:", response.choices[0].message.content)
                command_data = json.loads(response.choices[0].message.content)
            except Exception as ai_err:
                print("External AI service unavailable, using fallback voice parser:", ai_err)
                lower_t = transcript.lower()
                if "sci-fi" in lower_t:
                    command_data = {"command": "FILTER", "category": "Sci-Fi", "response": "Showing you all Sci-Fi movies"}
                elif "action" in lower_t:
                    command_data = {"command": "FILTER", "category": "Action", "response": "Showing you all Action movies"}
                elif "drama" in lower_t:
                    command_data = {"command": "FILTER", "category": "Drama", "response": "Showing you all Drama movies"}
                elif "cart" in lower_t:
                    command_data = {"command": "NAVIGATE", "page": "cart", "path": "/cart", "response": "Taking you to cart page"}
                elif "library" in lower_t or "order" in lower_t:
                    command_data = {"command": "NAVIGATE", "page": "library", "path": "/orders", "response": "Taking you to library"}
                elif "logout" in lower_t:
                    command_data = {"command": "LOGOUT", "response": "Logging you out"}
                else:
                    command_data = {"command": "UNKNOWN", "response": f"Voice input received: {transcript}"}
            
            return JsonResponse({
                "status": "Received ✅",
                "transcript": transcript,
                "aiResponse": command_data
            })
            
        except Exception as e:
            print("Error processing voice:", e)
            return JsonResponse({"error": "Failed to process voice command"}, status=500)


@csrf_exempt
def update_quantity(request, id):
    if request.method == "POST":
        try:
            admin_secret = request.headers.get('X-Admin-Secret') or request.GET.get('admin_secret')
            expected_secret = getattr(settings, 'ADMIN_SECRET', '') or os.environ.get('ADMIN_SECRET', 'cv_admin_secret_key')
            auth_user_id = get_authenticated_user_id(request)
            if not auth_user_id and (not admin_secret or admin_secret != expected_secret):
                return JsonResponse({"error": "Authorization required to update stock"}, status=403)

            data = json.loads(request.body)
            quantity = data.get('quantity')
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT quantity FROM movies WHERE movie_id = %s", [id])
                rows = cursor.fetchall()
                
                if len(rows) == 0:
                    return JsonResponse({"error": "Movie not found"}, status=404)
                
                current_quantity = rows[0][0] if rows[0][0] is not None else 0
                new_quantity = max(0, current_quantity + quantity)
                
                cursor.execute(
                    "UPDATE movies SET quantity = %s WHERE movie_id = %s",
                    [new_quantity, id]
                )
            
            return JsonResponse({
                "success": True,
                "message": "Movie cart quantity updated successfully",
                "newQuantity": new_quantity
            })
            
        except Exception as e:
            print("Error updating quantity:", e)
            return JsonResponse({
                "error": "Server error",
                "details": str(e)
            }, status=500)

@csrf_exempt
def login_user(request):
    if request.method == "POST":
        try:
            from django.contrib.auth.hashers import check_password, make_password
            data = json.loads(request.body)
            email = (data.get('email') or '').strip().lower()
            password = data.get('password') or ''
            
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM users WHERE LOWER(email) = LOWER(%s)",
                    [email]
                )
                users = cursor.fetchall()
                
                if len(users) > 0:
                    user = users[0]
                    col_names = [col[0] for col in cursor.description]
                    user_dict = dict(zip(col_names, user))
                    stored_pw = user_dict.get('password', '')

                    pw_valid = False
                    if stored_pw:
                        try:
                            pw_valid = check_password(password, stored_pw)
                        except Exception:
                            pw_valid = False

                        if not pw_valid and stored_pw == password:
                            pw_valid = True
                            try:
                                hashed_pw = make_password(password)
                                cursor.execute(
                                    "UPDATE users SET password = %s WHERE user_id = %s",
                                    [hashed_pw, user_dict['user_id']]
                                )
                            except Exception as update_err:
                                print("Legacy password upgrade notice:", update_err)

                    if pw_valid:
                        cursor.execute(
                            "UPDATE users SET is_logged_in = TRUE WHERE user_id = %s",
                            [user_dict['user_id']]
                        )
                        token = generate_auth_token(user_dict['user_id'])
                        return JsonResponse({
                            "success": True,
                            "user": {
                                "user_id": user_dict['user_id'],
                                "name": user_dict['name'],
                                "email": user_dict['email'],
                                "token": token
                            }
                        })
                    else:
                        return JsonResponse({"error": "Invalid email or password."}, status=401)
                else:
                    return JsonResponse({"error": "Account not found. Please check your email or register."}, status=404)
                    
        except Exception as e:
            print("Login error:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def signup_user(request):
    if request.method == "POST":
        try:
            from django.contrib.auth.hashers import make_password
            data = json.loads(request.body)
            name = (data.get('name') or '').strip()
            email = (data.get('email') or '').strip().lower()
            password = data.get('password') or ''
            
            if not name or not email or not password:
                return JsonResponse({"error": "All fields are required"}, status=400)
                
            hashed_pw = make_password(password)

            with connection.cursor() as cursor:
                cursor.execute("SELECT user_id FROM users WHERE LOWER(email) = LOWER(%s)", [email])
                existing = cursor.fetchall()
                
                if len(existing) > 0:
                    return JsonResponse({"error": "An account with this email already exists"}, status=400)
                
                cursor.execute(
                    "INSERT INTO users (name, email, password, is_logged_in) VALUES (%s, %s, %s, TRUE)",
                    [name, email, hashed_pw]
                )
                user_id = cursor.lastrowid
            
            token = generate_auth_token(user_id)
            return JsonResponse({
                "success": True,
                "user": {
                    "user_id": user_id,
                    "name": name,
                    "email": email,
                    "token": token
                }
            })
            
        except Exception as e:
            print("Signup error:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def logout_user(request, user_id):
    if request.method == "POST":
        try:
            auth_user_id = get_authenticated_user_id(request)
            if auth_user_id is None:
                return JsonResponse({"error": "Authentication token required"}, status=401)
            if int(auth_user_id) != int(user_id):
                return JsonResponse({"error": "Unauthorized logout attempt"}, status=403)

            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE users SET is_logged_in = FALSE WHERE user_id = %s",
                    [user_id]
                )
            
            return JsonResponse({"success": True})
            
        except Exception as e:
            print("Logout error:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def create_order(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get('userId')
            items = data.get('items')
            payment_method = data.get('paymentMethod', 'COD')
            
            print("Creating order:", {"userId": user_id, "items": items, "paymentMethod": payment_method})
            
            if not user_id or not items or not isinstance(items, list) or not len(items):
                return JsonResponse({"success": False, "error": "Missing required order fields"}, status=400)
            
            # Server-Side Price Validation: compute exact trusted amount from database!
            movie_ids = []
            for item in items:
                m_id = item.get('movie_id') or item.get('id')
                if m_id is not None:
                    movie_ids.append(m_id)
            
            if not movie_ids:
                return JsonResponse({"success": False, "error": "Invalid items in cart"}, status=400)
            
            with connection.cursor() as cursor:
                placeholders = ', '.join(['%s'] * len(movie_ids))
                cursor.execute(f"SELECT movie_id, title, price, rental_price, poster_image, genre, tmdb_id FROM movies WHERE movie_id IN ({placeholders})", movie_ids)
                db_rows = cursor.fetchall()
                db_movies = {row[0]: {'title': row[1], 'price': float(row[2]), 'rental_price': float(row[3] or 149.0), 'poster': row[4], 'genre': row[5], 'tmdb_id': row[6]} for row in db_rows}

            verified_items = []
            subtotal = 0.0
            for item in items:
                m_id = item.get('movie_id') or item.get('id')
                if m_id not in db_movies:
                    return JsonResponse({"success": False, "error": f"Movie ID {m_id} not found in database"}, status=400)
                
                db_m = db_movies[m_id]
                license_type = item.get('license_type') or 'purchase'
                item_price = db_m['rental_price'] if license_type == 'rental' else db_m['price']
                subtotal += item_price
                
                verified_items.append({
                    "movie_id": m_id,
                    "id": m_id,
                    "tmdb_id": db_m['tmdb_id'] or m_id,
                    "name": db_m['title'],
                    "title": db_m['title'],
                    "price": item_price,
                    "rental_price": db_m['rental_price'],
                    "license_type": license_type,
                    "poster": db_m['poster'],
                    "genre": db_m['genre']
                })

            tax = round(subtotal * 0.08, 2)
            total_amount = round(subtotal + tax, 2)
            order_id = 'ORD_' + str(int(datetime.now().timestamp())) + '_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
            items_json = json.dumps(verified_items)
            customer_details = json.dumps({"user_id": user_id})

            is_razorpay = payment_method in ['UPI', 'Razorpay', 'razorpay']
            razorpay_order_id = None
            if is_razorpay:
                try:
                    razorpay_order = razorpay_client.order.create({
                        'amount': int(round(total_amount * 100)),
                        'currency': 'INR',
                        'payment_capture': 1,
                        'receipt': order_id,
                        'notes': {
                            'user_id': str(user_id),
                            'order_id': order_id
                        }
                    })
                    razorpay_order_id = razorpay_order['id']
                    print(f"Razorpay order created: {razorpay_order_id}")
                except Exception as e:
                    print(f"Razorpay order creation failed: {e}")
                    return JsonResponse({"success": False, "error": "Payment gateway error: " + str(e)}, status=500)

            initial_status = 'pending' if is_razorpay else 'placed'

            with connection.cursor() as cursor:
                cursor.execute(
                    """INSERT INTO orders 
                       (order_id, amount, currency, payment_method, status, items, customer_details, razorpay_order_id) 
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    [order_id, total_amount, 'INR', payment_method, initial_status, items_json, customer_details, razorpay_order_id]
                )

            response_data = {
                "success": True,
                "orderId": order_id,
                "amount": total_amount,
                "message": "Movie order created successfully"
            }
            
            if is_razorpay and razorpay_order_id:
                response_data["razorpayOrderId"] = razorpay_order_id
                response_data["keyId"] = RAZORPAY_KEY_ID
            
            return JsonResponse(response_data)
            
        except Exception as e:
            print("Create order error:", e)
            return JsonResponse({"success": False, "error": str(e)}, status=500)

@csrf_exempt
def verify_payment(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            razorpay_payment_id = data.get('razorpay_payment_id')
            razorpay_order_id = data.get('razorpay_order_id')
            razorpay_signature = data.get('razorpay_signature')
            order_id = data.get('orderId')
            
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            
            try:
                razorpay_client.utility.verify_payment_signature(params_dict)
                payment_verified = True
            except Exception as e:
                print(f"Signature verification failed: {e}")
                return JsonResponse({"success": False, "error": "Payment verification failed"}, status=400)
            
            if payment_verified:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """UPDATE orders 
                           SET payment_id = %s, 
                               status = 'completed'
                           WHERE order_id = %s OR razorpay_order_id = %s""",
                        [razorpay_payment_id, order_id, razorpay_order_id]
                    )
                
                return JsonResponse({"success": True, "message": "Payment verified successfully"})
            else:
                return JsonResponse({"success": False, "error": "Invalid payment signature"}, status=400)
            
        except Exception as e:
            print("Payment verification error:", e)
            return JsonResponse({"error": "Server error", "details": str(e)}, status=500)

@csrf_exempt
def get_user_orders(request, user_id):
    if request.method == "GET":
        try:
            auth_user_id = get_authenticated_user_id(request)
            if auth_user_id is None:
                return JsonResponse({"error": "Authentication token required"}, status=401)
            if int(auth_user_id) != int(user_id):
                return JsonResponse({"error": "Unauthorized access to order history"}, status=403)

            with connection.cursor() as cursor:
                cursor.execute(
                    """SELECT * FROM orders 
                       WHERE JSON_UNQUOTE(JSON_EXTRACT(customer_details, '$.user_id')) = %s
                          OR customer_details LIKE %s
                          OR customer_details LIKE %s
                       ORDER BY created_at DESC""",
                    [str(user_id), f'%"{user_id}"%', f'%:{user_id}%']
                )
                orders = cursor.fetchall()
                col_names = [col[0] for col in cursor.description]
                
                orders_with_items = []
                for order in orders:
                    order_dict = dict(zip(col_names, order))
                    status = (order_dict.get('status') or 'placed').lower()
                    if status not in ['placed', 'completed', 'paid']:
                        continue
                    
                    items = []
                    try:
                        items = json.loads(order_dict.get('items', '[]'))
                    except Exception:
                        items = []
                    
                    customer_details = {}
                    try:
                        customer_details = json.loads(order_dict.get('customer_details', '{}'))
                    except Exception:
                        customer_details = {}
                    
                    orders_with_items.append({
                        "id": order_dict.get('id'),
                        "order_id": order_dict.get('order_id'),
                        "order_date": order_dict.get('created_at'),
                        "total_amount": float(order_dict.get('amount') or 0.0),
                        "payment_method": order_dict.get('payment_method'),
                        "payment_id": order_dict.get('payment_id'),
                        "order_status": status,
                        "items": items,
                        "customer_details": customer_details
                    })
            
            return JsonResponse(orders_with_items, safe=False)
        except Exception as e:
            print("Error fetching orders:", e)
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def update_order_status(request, order_id):
    if request.method == "POST":
        try:
            admin_secret = request.headers.get('X-Admin-Secret') or request.GET.get('admin_secret')
            expected_secret = getattr(settings, 'ADMIN_SECRET', '') or os.environ.get('ADMIN_SECRET', 'cv_admin_secret_key')
            if not admin_secret or admin_secret != expected_secret:
                return JsonResponse({"error": "Administrative authorization required"}, status=403)

            data = json.loads(request.body)
            status = data.get('status')
            
            with connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE orders SET status = %s WHERE order_id = %s",
                    [status, order_id]
                )
            
            return JsonResponse({"success": True})
            
        except Exception as e:
            print("Error updating order status:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def session_cart_operations(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            session_id = data.get('sessionId')
            movie_id = data.get('movieId') or data.get('movie_id')
            quantity = data.get('quantity')
            
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM session_carts WHERE session_id = %s AND movie_id = %s",
                    [session_id, movie_id]
                )
                existing = cursor.fetchall()
                
                if len(existing) > 0:
                    cursor.execute(
                        "UPDATE session_carts SET quantity = %s WHERE session_id = %s AND movie_id = %s",
                        [quantity, session_id, movie_id]
                    )
                else:
                    cursor.execute(
                        "INSERT INTO session_carts (session_id, movie_id, quantity) VALUES (%s, %s, %s)",
                        [session_id, movie_id, quantity]
                    )
            
            return JsonResponse({"success": True})
            
        except Exception as e:
            print("Session cart error:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def get_session_cart(request, session_id):
    if request.method == "GET":
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """SELECT sc.*, m.title AS MovieName, m.title AS title, m.price AS Price, m.poster_image AS ImageName 
                       FROM session_carts sc
                       JOIN movies m ON sc.movie_id = m.movie_id
                       WHERE sc.session_id = %s""",
                    [session_id]
                )
                rows = cursor.fetchall()
                
                col_names = [col[0] for col in cursor.description]
                
                cart_items = []
                for row in rows:
                    cart_items.append(dict(zip(col_names, row)))
            
            return JsonResponse(cart_items, safe=False)
            
        except Exception as e:
            print("Error fetching session cart:", e)
            return JsonResponse({"error": "Server error"}, status=500)

@csrf_exempt
def clear_session_cart(request, session_id):
    if request.method == "DELETE":
        try:
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM session_carts WHERE session_id = %s", [session_id])
            
            return JsonResponse({"success": True})
            
        except Exception as e:
            print("Error clearing session cart:", e)
            return JsonResponse({"error": "Server error"}, status=500)

def is_quality_tmdb_movie(item, is_search=False):
    if not item or not isinstance(item, dict):
        return False
    
    poster_path = item.get('poster_path')
    backdrop_path = item.get('backdrop_path')
    if not poster_path and not backdrop_path:
        return False
    
    overview = (item.get('overview') or '').strip()
    if not overview:
        return False
    
    vote_count = item.get('vote_count', 0)
    vote_average = float(item.get('vote_average', 0.0))

    if item.get('adult') is True:
        return False

    if not is_search:
        if vote_count < 5 and vote_average < 4.0:
            return False
    else:
        if vote_count == 0 and vote_average == 0.0 and not poster_path:
            return False
            
    return True

@csrf_exempt
def sync_tmdb_movies(request):
    import urllib.request
    import urllib.parse
    tmdb_key = getattr(settings, 'TMDB_API_KEY', '') or os.environ.get('TMDB_API_KEY', '')
    pages = int(request.GET.get('pages', 3))
    category = request.GET.get('category', 'popular')
    query = request.GET.get('query', '')

    if not tmdb_key:
        return JsonResponse({
            "status": "cached",
            "message": "Using database-cached TMDB catalog (set TMDB_API_KEY in environment for live API fetches)."
        })
    
    try:
        inserted = 0
        updated = 0
        total_fetched = 0

        for page_num in range(1, pages + 1):
            if query:
                url = f"https://api.themoviedb.org/3/search/movie?api_key={tmdb_key}&query={urllib.parse.quote(query)}&page={page_num}"
            else:
                url = f"https://api.themoviedb.org/3/movie/{category}?api_key={tmdb_key}&page={page_num}"

            req = urllib.request.Request(url, headers={'User-Agent': 'CineVerse/1.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
                results = data.get('results', [])
                total_fetched += len(results)

                with connection.cursor() as cursor:
                    for item in results:
                        if not is_quality_tmdb_movie(item, is_search=False):
                            continue

                        tmdb_id = str(item.get('id'))
                        title = item.get('title') or 'Movie'
                        overview = item.get('overview') or ''
                        rating = round(float(item.get('vote_average', 8.0)), 1)
                        poster_path = item.get('poster_path')
                        backdrop_path = item.get('backdrop_path')
                        genre = resolve_tmdb_genre(item.get('genre_ids', []))

                        poster = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else ''
                        backdrop = f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else poster

                        cursor.execute("SELECT movie_id FROM movies WHERE tmdb_id = %s OR LOWER(title) = LOWER(%s)", [tmdb_id, title])
                        existing = cursor.fetchone()

                        if not existing:
                            cursor.execute("""
                                INSERT INTO movies (title, description, price, rental_price, genre, poster_image, backdrop_image, rating, tmdb_id, is_available)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                            """, [title, overview, 499.00, 149.00, genre, poster, backdrop, rating, tmdb_id])
                            inserted += 1
                        else:
                            cursor.execute("""
                                UPDATE movies 
                                SET title = %s, description = %s, rating = %s, poster_image = %s, backdrop_image = %s, genre = %s, tmdb_id = %s
                                WHERE movie_id = %s
                            """, [title, overview, rating, poster, backdrop, genre, tmdb_id, existing[0]])
                            updated += 1

        return JsonResponse({
            "status": "success",
            "synced_pages": pages,
            "total_fetched": total_fetched,
            "new_inserted": inserted,
            "updated": updated
        })
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@csrf_exempt
def search_movies(request):
    if request.method == "GET":
        try:
            import urllib.request
            import urllib.parse

            query = (request.GET.get('query') or '').strip()
            if not query:
                return JsonResponse([], safe=False)

            tmdb_key = getattr(settings, 'TMDB_API_KEY', '') or os.environ.get('TMDB_API_KEY', '')

            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM movies WHERE LOWER(title) LIKE %s OR LOWER(genre) LIKE %s",
                    [f"%{query.lower()}%", f"%{query.lower()}%"]
                )
                rows = cursor.fetchall()
                columns = [col[0] for col in cursor.description]
                local_results = [dict(zip(columns, row)) for row in rows]
                existing_tmdb_ids = {str(m.get('tmdb_id')) for m in local_results if m.get('tmdb_id')}
                existing_titles = {m.get('title', '').lower() for m in local_results if m.get('title')}

            if tmdb_key:
                try:
                    url = f"https://api.themoviedb.org/3/search/movie?api_key={tmdb_key}&query={urllib.parse.quote(query)}"
                    req = urllib.request.Request(url, headers={'User-Agent': 'CineVerse/1.0'})
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        tmdb_data = json.loads(resp.read().decode())
                        tmdb_items = tmdb_data.get('results', [])

                        with connection.cursor() as cursor:
                            for item in tmdb_items[:10]:
                                if not is_quality_tmdb_movie(item, is_search=True):
                                    continue

                                t_id = str(item.get('id'))
                                t_title = item.get('title') or 'Movie'
                                cursor.execute("SELECT movie_id FROM movies WHERE tmdb_id = %s OR LOWER(title) = LOWER(%s)", [t_id, t_title])
                                if cursor.fetchone():
                                    continue

                                t_overview = item.get('overview') or ''
                                t_rating = round(float(item.get('vote_average', 8.0)), 1)
                                t_poster_path = item.get('poster_path')
                                t_backdrop_path = item.get('backdrop_path')
                                t_genre = resolve_tmdb_genre(item.get('genre_ids', []))

                                t_poster = f"https://image.tmdb.org/t/p/w500{t_poster_path}" if t_poster_path else ''
                                t_backdrop = f"https://image.tmdb.org/t/p/w1280{t_backdrop_path}" if t_backdrop_path else t_poster

                                cursor.execute("""
                                    INSERT INTO movies (title, description, price, rental_price, genre, poster_image, backdrop_image, rating, tmdb_id, is_available)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
                                """, [t_title, t_overview, 499.00, 149.00, t_genre, t_poster, t_backdrop, t_rating, t_id])

                                existing_tmdb_ids.add(t_id)
                                existing_titles.add(t_title.lower())

                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT * FROM movies WHERE LOWER(title) LIKE %s OR LOWER(genre) LIKE %s",
                                [f"%{query.lower()}%", f"%{query.lower()}%"]
                            )
                            rows = cursor.fetchall()
                            columns = [col[0] for col in cursor.description]
                            local_results = [dict(zip(columns, row)) for row in rows]
                except Exception as tmdb_err:
                    print("Live TMDB search notice:", tmdb_err)

            normalized = []
            for m in local_results:
                m_id = m.get('movie_id')
                title = m.get('title') or 'Movie'
                normalized.append({
                    'id': m_id,
                    'movie_id': m_id,
                    'MovieID': m_id,
                    'tmdb_id': m.get('tmdb_id') or m_id,
                    'title': title,
                    'MovieName': title,
                    'genre': m.get('genre') or 'Cinema',
                    'Category': m.get('genre') or 'Cinema',
                    'price': float(m.get('price') or 499.00),
                    'Price': float(m.get('price') or 499.00),
                    'rental_price': float(m.get('rental_price') or 149.00),
                    'rating': float(m.get('rating') or 8.0),
                    'Rating': float(m.get('rating') or 8.0),
                    'description': m.get('description') or '',
                    'Description': m.get('description') or '',
                    'poster_image': m.get('poster_image') or '',
                    'ImageName': m.get('poster_image') or '',
                    'backdrop_image': m.get('backdrop_image') or m.get('poster_image') or '',
                    'quantity': m.get('quantity', 0),
                    'is_available': m.get('is_available', 1)
                })

            return JsonResponse(normalized, safe=False)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
def get_watch_providers(request, tmdb_id):
    import urllib.request
    tmdb_key = getattr(settings, 'TMDB_API_KEY', '') or os.environ.get('TMDB_API_KEY', '')
    if not tmdb_key:
        return JsonResponse({
            "available": False,
            "providers": [],
            "message": "Watch provider information is unavailable for this title."
        })
    try:
        url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers?api_key={tmdb_key}"
        req = urllib.request.Request(url, headers={'User-Agent': 'CineVerse/1.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            results = data.get('results', {}).get('US', {}) or data.get('results', {}).get('IN', {})
            flatrate = results.get('flatrate', [])
            rent = results.get('rent', [])
            buy = results.get('buy', [])
            
            providers = []
            for p in flatrate + rent + buy:
                pname = p.get('provider_name')
                if pname and pname not in providers:
                    providers.append(pname)
            
            if providers:
                return JsonResponse({"available": True, "providers": providers})
            else:
                return JsonResponse({"available": False, "providers": [], "message": "Watch provider information unavailable for this title."})
    except Exception as e:
        return JsonResponse({"available": False, "providers": [], "message": str(e)})

@csrf_exempt
def get_single_movie(request, movie_id):
    if request.method == "GET":
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT * FROM movies WHERE movie_id = %s", [movie_id])
                row = cursor.fetchone()
                if not row:
                    return JsonResponse({"error": "Movie not found"}, status=404)
                columns = [col[0] for col in cursor.description]
                movie_dict = dict(zip(columns, row))
                m_id = movie_dict.get('movie_id')
                movie_dict['id'] = m_id
                movie_dict['movie_id'] = m_id
                movie_dict['MovieID'] = m_id
                movie_dict['title'] = movie_dict.get('title')
                movie_dict['MovieName'] = movie_dict.get('title')
                movie_dict['genre'] = movie_dict.get('genre') or 'Cinema'
                movie_dict['Category'] = movie_dict.get('genre') or 'Cinema'
                movie_dict['poster_image'] = movie_dict.get('poster_image') or ''
                movie_dict['ImageName'] = movie_dict.get('poster_image') or ''
                movie_dict['backdrop_image'] = movie_dict.get('backdrop_image') or movie_dict.get('poster_image') or ''
                movie_dict['price'] = float(movie_dict.get('price') or 499.00)
                movie_dict['Price'] = float(movie_dict.get('price') or 499.00)
                movie_dict['rental_price'] = float(movie_dict.get('rental_price') or 149.00)
                movie_dict['quantity'] = movie_dict.get('quantity', 0)
                raw_tmdb_r = movie_dict.get('rating')
                tmdb_r_val = float(raw_tmdb_r if raw_tmdb_r is not None else 8.0)
                movie_dict['tmdb_rating'] = tmdb_r_val

                raw_imdb_r = movie_dict.get('imdb_rating')
                imdb_r_val = float(raw_imdb_r) if raw_imdb_r is not None else None
                movie_dict['imdb_rating'] = imdb_r_val
                movie_dict['imdb_id'] = movie_dict.get('imdb_id')

                movie_dict['rating'] = imdb_r_val if imdb_r_val is not None else tmdb_r_val
                movie_dict['Rating'] = movie_dict['rating']
                return JsonResponse(movie_dict)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)