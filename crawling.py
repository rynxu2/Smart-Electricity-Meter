import os

# Đường dẫn folder chứa file
folder_path = r"C:\Users\dobao\Downloads\Daset.v2i.yolov11 (1)\New folder"

# Prefix tên mới
prefix = "images"

# Lấy danh sách file
files = os.listdir(folder_path)

# Chỉ lấy file, bỏ folder con
files = [f for f in files if os.path.isfile(os.path.join(folder_path, f))]

# Sắp xếp để rename ổn định
files.sort()

# Đổi tên
for index, filename in enumerate(files, start=1):
    old_path = os.path.join(folder_path, filename)

    # Lấy phần mở rộng file
    ext = os.path.splitext(filename)[1]

    # Tên mới
    new_name = f"{prefix}{index}{ext}"
    new_path = os.path.join(folder_path, new_name)

    os.rename(old_path, new_path)

    print(f"{filename} -> {new_name}")

print("Đổi tên hoàn tất!")