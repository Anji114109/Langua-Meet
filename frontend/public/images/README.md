# Images Folder

This folder is for storing all static image assets for the LinguaMeet application.

## How to Add Images

1. **Logo Image**: 
   - Place your logo file here and name it `logo.png`
   - The logo will display on the landing page and about modal
   - Recommended size: 200x200 pixels or higher (SVG or PNG with transparent background)
   - Path: `/images/logo.png`

2. **Feature Card Images** (Optional):
   - If you want to add images to feature cards, place them here
   - Name them: `feature-1.png`, `feature-2.png`, etc.
   - Path: `/images/feature-1.png`

## How to Use in Code

Reference images from the public folder using paths like:
```jsx
<img src="/images/logo.png" alt="Logo" />
```

## Supported Formats

- PNG (recommended for transparency)
- JPG/JPEG
- SVG
- WebP

## Notes

- All images in this folder are served statically
- Use optimized/compressed images for better performance
- Transparent backgrounds work best for logos
