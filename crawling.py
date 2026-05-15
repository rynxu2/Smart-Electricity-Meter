import os
import time
import requests
import base64
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def setup_download_folder(folder_name="downloaded_images"):
    """Tạo thư mục để lưu ảnh nếu chưa tồn tại"""
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)
    return folder_name

def download_image(url, folder, file_name):
    """Tải và lưu ảnh (hỗ trợ cả Base64 và HTTP URL)"""
    try:
        # Trường hợp 1: Ảnh dạng Base64 (Google thường dùng cho thumbnail)
        if url.startswith("data:image"):
            # Tách phần header và phần dữ liệu
            header, encoded = url.split(",", 1)
            # Đoán định dạng file (ví dụ: image/jpeg -> jpg)
            ext = header.split("/")[1].split(";")[0]
            if ext == "jpeg": ext = "jpg"
            
            # Giải mã và lưu
            data = base64.b64decode(encoded)
            with open(os.path.join(folder, f"{file_name}.{ext}"), "wb") as f:
                f.write(data)
            return True

        # Trường hợp 2: Ảnh dạng URL HTTP/HTTPS thông thường
        else:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # Thử lấy định dạng từ header
                content_type = response.headers.get('content-type', '')
                ext = "jpg" # mặc định
                if "png" in content_type: ext = "png"
                elif "webp" in content_type: ext = "webp"
                
                with open(os.path.join(folder, f"{file_name}.{ext}"), "wb") as f:
                    f.write(response.content)
                return True
    except Exception as e:
        print(f"Lỗi khi tải {file_name}: {e}")
    return False

def crawl_and_save(url):
    # Cấu hình Chrome
    chrome_options = Options()
    # Bỏ comment dòng dưới nếu bạn không muốn hiện cửa sổ trình duyệt (Headless mode)
    # chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    print("Đang khởi động trình duyệt...")
    driver = webdriver.Chrome(options=chrome_options)
    
    # Tạo thư mục
    folder = setup_download_folder()
    
    try:
        driver.get(url)
        print("Đang tải trang web...")
        time.sleep(20)

        print("Đang cuộn trang để tải thêm ảnh...")
        for _ in range(10):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)

        images = driver.find_elements(By.TAG_NAME, "img")
        print(f"Tìm thấy {len(images)} thẻ ảnh trên màn hình. Bắt đầu tải...")

        count = 0
        for img in images:
            src = img.get_attribute("src")
            # Loại bỏ các ảnh không có src hoặc các icon quá nhỏ
            if src:
                width = img.get_attribute("width")
                if width and width.isdigit() and int(width) < 30:
                    continue # Bỏ qua các icon kích thước nhỏ hơn 30px

                # Gọi hàm tải ảnh
                file_name = f"cong_to_dien_{count:03d}"
                if download_image(src, folder, file_name):
                    count += 1
                    if count % 10 == 0:
                        print(f" Đã tải xong {count} ảnh...")

        print(f"\n✅ Hoàn tất! Đã tải thành công {count} ảnh vào thư mục '{folder}'.")

    except Exception as e:
        print(f"Có lỗi xảy ra trong quá trình chạy: {e}")
        
    finally:
        driver.quit()

if __name__ == "__main__":
    # URL tìm kiếm "công tơ điện"
    target_url = "https://www.google.com/search?sca_esv=dbcb67f4d240fbb9&sxsrf=ANbL-n4UnHOay5WT_1CZRCRhVyMu_govXQ:1778578716216&udm=2&fbs=ADc_l-aN0CWEZBOHjofHoaMMDiKpaEWjvZ2Py1XXV8d8KvlI3o6iwGk6Iv1tRbZIBNIVs-6UIUc6UR6SuJFZzmDZDaBCXj3NZJ_DMK_QqUo9V0Ifj3Uw9JxMQtyGfelIHFwguFQhq8OSzED--4jq4cAPv8SGSUDRDuqgmpcrDPi8V_4UKGuF2j_f68HRWe7PxRLWCLvv0_cGtyTmF7NLVae1lqEvW2YdoA&q=c%C3%B4ng+t%C6%A1+%C4%91i%E1%BB%87n&sa=X&ved=2ahUKEwjD79aEurOUAxXkka8BHaEsJJcQtKgLegQIGhAB&biw=2560&bih=1351&dpr=1#sv=CAMSVhoyKhBlLVp6ZEw3QkFZcmktVDdNMg5aemRMN0JBWXJpLVQ3TToOYXZnWmtjNDBzeTBQY00gBCocCgZtb3NhaWMSEGUtWnpkTDdCQVlyaS1UN00YADABGAcgtoLBwQJKCBABGAEgASgB"
    
    crawl_and_save(target_url)