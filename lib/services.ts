import { InputType } from "./definition";

export async function postGenerateVideo(input: InputType) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL as string;
  const formData = new FormData();
  formData.append("video", input.video);
  formData.append("subtitle", input.subtitle);

  try {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(result);
    return result;
  } catch (error) {
    console.error("Error uploading video:", error);
    throw error;
  }
}
