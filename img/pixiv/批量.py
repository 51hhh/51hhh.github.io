import os

def list_files_in_folder(folder_path, prefix="/img/pixiv/8.11"):
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith((".jpg", ".png", ".gif",".webp")):
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, folder_path)
                print(f"![]({prefix}/{relative_path} \"{file}\")")

# 替换下面的'your_folder_path'为你要读取的文件夹路径
your_folder_path = "D:\\win\\polar\\source\\img\\pixiv\\8.11"
list_files_in_folder(your_folder_path)
input("Press Enter to continue...")
